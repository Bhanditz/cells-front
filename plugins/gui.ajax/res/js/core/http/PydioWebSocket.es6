/*
 * Copyright 2007-2017 Charles du Jeu - Abstrium SAS <team (at) pyd.io>
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

import AjxpNode from '../model/AjxpNode'
import PathUtils from '../util/PathUtils'
import PydioApi from './PydioApi'
import MetaNodeProvider from '../model/MetaNodeProvider'
const ReconnectingWebSocket = require('reconnecting-websocket');
import debounce from 'lodash.debounce'

/**
 * WebSocket client
 */
class PydioWebSocket {

    /**
     *
     * @param pydioObject Pydio
     */
    constructor(pydioObject) {

        this.pydio = pydioObject;

        this.connOpen = false;
        this.ws = null;
        this.reloadRepositoriesDebounced = debounce(() => {
            this.pydio.reloadRepositoriesList();
        }, 500);

        this.pydio.observe("repository_list_refreshed", function (data) {

            let repoId;
            if (data.active) {
                repoId = data.active;
            } else if (this.pydio.repositoryId) {
                repoId = this.pydio.repositoryId;
            }
            if(!repoId){
                this.close();
            } else if(!this.connOpen) {
                this.open();
            } else {
                this.refresh();
            }

        }.bind(this));

    }

    isOpen() {
        return this.connOpen && this.ws !== null;
    }

    close () {
        if (!this.connOpen || this.ws === null) {
            return;
        }
        this.ws.close(1000, 'Closing', {keepClosed: true});
    }

    /**
     * Open a connection
     */
    open() {
        const url = this.pydio.getPluginConfigs("core.conf").get("ENDPOINT_WEBSOCKET");
        this.ws = new ReconnectingWebSocket(url, [], {
            maxReconnectionDelay: 60000,
            reconnectionDelayGrowFactor: 1.6,
            maxRetries: 10
        });

        this.ws.addEventListener('open', () => {
            this.connOpen = true;
            PydioWebSocket.subscribeJWT(this.ws);
        });
        this.ws.addEventListener('message', this.parseWebsocketMessage.bind(this));
        this.ws.addEventListener('close', (event) => {
            this.connOpen = false;
            PydioWebSocket.logClose(event)
        });
        this.ws.addEventListener('error', (error) => {
            if (error.code === 'EHOSTDOWN') {
                console.error('WebSocket maxRetries reached, host is down!');
            }
        });
    }

    refresh() {
        if(this.ws){
            PydioWebSocket.subscribeJWT(this.ws);
        } else {
            this.open();
        }
    }

    parseWebsocketMessage(msg){
        const dm = this.pydio.getContextHolder();
        let event = JSON.parse(msg.data);
        if (event === "dump") {
            return
        }
        if (event['@type']) {
            this.pydio.fire("websocket_event:" + event['@type'], event);
        }
        if (event['@type'] && event['@type'] === "idm") {
            this.reloadRepositoriesDebounced();
            return;
        }
        if (event['TaskUpdated'] && event['Job']) {
            this.pydio.fire("task_message", event);
            return;
        }
        if (!event.Type && event.Target) {
            event.Type = "CREATE";
        }
        let target;
        let currentRepoId = this.pydio.user.getActiveRepository();
        if (! this.pydio.user.repositories.has(currentRepoId) ){
            return;
        }
        let currentRepoSlug = this.pydio.user.repositories.get(currentRepoId).getSlug();
        switch (event.Type) {
            case "CREATE":
                target = PydioWebSocket.parseEventNode(event.Target, currentRepoId, currentRepoSlug);
                if (target === null) {
                    return;
                }
                dm.addNode(target, false);
                break;
            case "UPDATE_PATH":
            case "UPDATE_META":
            case "UPDATE_CONTENT":
                target = PydioWebSocket.parseEventNode(event.Target, currentRepoId, currentRepoSlug);
                if (target === null) {
                    return;
                }
                if (event.Source){
                    let source = PydioWebSocket.parseEventNode(event.Source, currentRepoId, currentRepoSlug);
                    target.getMetadata().set("original_path", source.getPath());
                } else {
                    target.getMetadata().set("original_path", target.getPath());
                }
                dm.updateNode(target, false);
                break;
            case "DELETE":
                let source = PydioWebSocket.parseEventNode(event.Source, currentRepoId, currentRepoSlug);
                if (source === null) {
                    return;
                }
                dm.removeNodeByPath( '/' + source.getPath());
                break;
            default:
                break;
        }
    }

    static parseEventNode(obj, currentRepoId, currentRepoSlug) {
        if (!obj){
            return null;
        }
        let wsId = JSON.parse(obj.MetaStore.EventWorkspaceId);
        if (wsId !== currentRepoId) {
            return null;
        }
        return MetaNodeProvider.parseTreeNode(obj, currentRepoSlug);
    }

    /**
     * @return AjxpNode | null
     * @param obj
     * @param currentRepoId string
     * @param currentRepoSlug string
     */
    static parseJSONNode(obj, currentRepoId, currentRepoSlug) {

        if (!obj){
            return null;
        }

        let wsId = JSON.parse(obj.MetaStore.EventWorkspaceId);
        let nodeName;
        if (obj.MetaStore.name){
            nodeName = JSON.parse(obj.MetaStore.name);
        } else{
            nodeName = PathUtils.getBasename(obj.Path);
        }
        if (wsId === currentRepoId) {
            obj.Path = obj.Path.substr(currentRepoSlug.length + 1)
        } else {
            return null;
        }

        let node = new AjxpNode('/' + obj.Path, obj.Type === "LEAF", nodeName, '', null);

        let meta = obj.MetaStore;
        for (let k in meta){
            if (meta.hasOwnProperty(k)) {
                let metaValue = JSON.parse(meta[k]);
                node.getMetadata().set(k, metaValue);
                if (typeof metaValue === 'object') {
                    for (let kSub in metaValue) {
                        if (metaValue.hasOwnProperty(kSub)) {
                            node.getMetadata().set(kSub, metaValue[kSub]);
                        }
                    }
                }
            }
        }
        node.getMetadata().set('filename', node.getPath());
        if(node.isLeaf() && pydio && pydio.Registry){
            const ext = PathUtils.getFileExtension(node.getPath());
            const registered = pydio.Registry.getFilesExtensions();
            if(registered.has(ext)){
                const {messageId, fontIcon} = registered.get(ext);
                node.getMetadata().set('fonticon',fontIcon);
                node.getMetadata().set('mimestring_id',messageId);
            }
        }
        if (obj.Size !== undefined){
            node.getMetadata().set('bytesize', obj.Size);
        }
        if (obj.MTime !== undefined){
            node.getMetadata().set('ajxp_modiftime', obj.MTime);
        }
        if (obj.Etag !== undefined){
            node.getMetadata().set('etag', obj.Etag);
        }
        if (obj.Uuid !== undefined){
            node.getMetadata().set('uuid', obj.Uuid);
        }
        return node;

    }

    /**
     *
     * @param ws
     * @return {*|Promise.<string>}
     */
    static subscribeJWT(ws) {
        return PydioApi.getRestClient().getOrUpdateJwt().then((jwt) =>{
            ws.send(JSON.stringify({
                "@type":"subscribe",
                "jwt"  : jwt
            }));
        });
    }

    static logClose(event) {
        let reason;
        switch (event.code){
            case 1000:
                reason = "Normal closure, meaning that the purpose for which the connection was established has been fulfilled.";
                break;
            case 1001:
                reason = "An endpoint is \"going away\", such as a server going down or a browser having navigated away from a page.";
                break;
            case 1002:
                reason = "An endpoint is terminating the connection due to a protocol error";
                break;
            case 1003:
                reason = "An endpoint is terminating the connection because it has received a type of data it cannot accept (e.g., an endpoint that understands only text data MAY send this if it receives a binary message).";
                break;
            case 1004:
                reason = "Reserved. The specific meaning might be defined in the future.";
                break;
            case 1005:
                reason = "No status code was actually present.";
                break;
            case 1006:
                reason = "The connection was closed abnormally, e.g., without sending or receiving a Close control frame";
                break;
            case 1007:
                reason = "An endpoint is terminating the connection because it has received data within a message that was not consistent with the type of the message (e.g., non-UTF-8 [http://tools.ietf.org/html/rfc3629] data within a text message).";
                break;
            case 1008:
                reason = "An endpoint is terminating the connection because it has received a message that \"violates its policy\". This reason is given either if there is no other sutible reason, or if there is a need to hide specific details about the policy.";
                break;
            case 1009:
                reason = "An endpoint is terminating the connection because it has received a message that is too big for it to process.";
                break;
            case 1010: // Note that this status code is not used by the server, because it can fail the WebSocket handshake instead.
                reason = "An endpoint (client) is terminating the connection because it has expected the server to negotiate one or more extension, but the server didn't return them in the response message of the WebSocket handshake. Specifically, the extensions that are needed are: " + event.reason;
                break;
            case 1011:
                reason = "A server is terminating the connection because it encountered an unexpected condition that prevented it from fulfilling the request.";
                break;
            case 1015:
                reason = "The connection was closed due to a failure to perform a TLS handshake (e.g., the server certificate can't be verified).";
                break;
            default:
                reason = "Unknown reason";
                break;
        }
        if (event.code > 1000 && console) {
            console.error("WebSocket Closed Connection:" + reason + " (code " + event.code + ")");
        }
    }

}

export {PydioWebSocket as default};