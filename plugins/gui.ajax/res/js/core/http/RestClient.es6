/*
 * Copyright 2007-2018 Charles du Jeu - Abstrium SAS <team (at) pyd.io>
 * This file is part of Pydio.
 *
 * Pydio is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Pydio is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Pydio.  If not, see <http://www.gnu.org/licenses/>.
 *
 * The latest code can be found at <https://pydio.com>.
 */

import PydioApi from './PydioApi'
const {ApiClient} = require('./gen/index');
import moment from 'moment'
import JobsServiceApi from "./gen/api/JobsServiceApi";
import RestUserJobRequest from "./gen/model/RestUserJobRequest";

// Override parseDate method to support ISO8601 cross-browser
ApiClient.parseDate = function (str) {
    return moment(str).toDate();
};


// Override callApi Method
class JwtApiClient extends ApiClient{

    constructor(pydioObject){
        super();
        this.basePath = pydioObject.getPluginConfigs('core.conf').get('ENDPOINT_REST_API');
        this.enableCookies = true; // enables withCredentials()
        this.pydio = pydioObject;
        pydioObject.observe('beforeApply-logout', ()=>{
            PydioApi.JWT_DATA = null;
        });
    }

    /**
     * @return Promise
     */
    getOrUpdateJwt(){

        return new Promise((resolve) => {

            const now = Math.floor(Date.now() / 1000);
            if(!PydioApi.JWT_DATA || PydioApi.JWT_DATA['expirationTime'] <= now + 10) {
                PydioApi.getClient().request({get_action:'jwt', client_time:now}, (t) => {
                    PydioApi.JWT_DATA = t.responseJSON;
                    resolve(PydioApi.JWT_DATA['jwt']);
                });
            } else {
                resolve(PydioApi.JWT_DATA['jwt']);
            }

        });

    }


    /**
     * Invokes the REST service using the supplied settings and parameters.
     * @param {String} path The base URL to invoke.
     * @param {String} httpMethod The HTTP method to use.
     * @param {Object.<String, String>} pathParams A map of path parameters and their values.
     * @param {Object.<String, Object>} queryParams A map of query parameters and their values.
     * @param {Object.<String, Object>} headerParams A map of header parameters and their values.
     * @param {Object.<String, Object>} formParams A map of form parameters and their values.
     * @param {Object} bodyParam The value to pass as the request body.
     * @param {Array.<String>} authNames An array of authentication type names.
     * @param {Array.<String>} contentTypes An array of request MIME types.
     * @param {Array.<String>} accepts An array of acceptable response MIME types.
     * @param {(String|Array|ObjectFunction)} returnType The required type to return; can be a string for simple types or the
     * constructor for a complex type.
     * @returns {Promise} A {@link https://www.promisejs.org/|Promise} object.
     */
    callApi(path, httpMethod, pathParams,
            queryParams, headerParams, formParams, bodyParam, authNames, contentTypes, accepts,
            returnType) {

        if (this.pydio.user && this.pydio.user.getPreference("lang")) {
            headerParams["X-Pydio-Language"] = this.pydio.user.getPreference("lang");
        }

        return new Promise((resolve, reject) => {

            this.getOrUpdateJwt().then((jwt) => {
                this.authentications = {'oauth2': {type:'oauth2', accessToken: jwt}};
                const p = super.callApi(path, httpMethod, pathParams, queryParams, headerParams, formParams, bodyParam, ['oauth2'], contentTypes, accepts, returnType);
                p.then((response) => {
                    resolve(response);
                }).catch((reason) => {
                    this.handleError(reason);
                    reject(reason);
                })
            }).catch((reason) =>{
                this.handleError(reason);
                reject(reason);
            });

        });


    }

    handleError(reason) {
        let msg = reason.message;
        if (reason.response && reason.response.text){
            msg = reason.response.text;
        }
        if(this.pydio && this.pydio.UI) {
            this.pydio.UI.displayMessage('ERROR', msg);
        }
        if (console) {
            console.error(reason);
        }
    }

    /**
     *
     * @param name
     * @param parameters
     * @return {Promise}
     */
    userJob(name, parameters) {
        const api = new JobsServiceApi(this);
        let request = new RestUserJobRequest();
        request.JobName = name;
        request.JsonParameters = JSON.stringify(parameters);
        return api.userCreateJob(name, request);
    }

}

export {JwtApiClient as default}