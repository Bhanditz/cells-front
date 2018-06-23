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

const PydioApi = require('pydio/http/api');

export default function (pydio) {
    /**
     * @param type string
     * @param selection {PydioDataModel}
     * @param path string
     * @param wsId string
     */
    return function(type, selection, path, wsId){
        let action, params = {dest:path};
        if(wsId) {
            action = 'cross_copy';
            params['dest_repository_id'] = wsId;
            if(type === 'move') {
                params['moving_files'] = 'true';
            }
            PydioApi.getClient().postSelectionWithAction(action, null, selection, params);
            return;
        }

        const slug = pydio.user.getActiveRepositoryObject().getSlug();
        const paths = selection.getSelectedNodes().map(n => slug + n.getPath());
        const jobParams =  {
            nodes: paths,
            target: slug + path,
            targetParent: true
        };
        PydioApi.getRestClient().userJob(type, jobParams).then(r => {
            pydio.UI.displayMessage('SUCCESS', type === 'move' ? 'Move operation in background' : 'Copy operation in background');
            pydio.getContextHolder().setSelectedNodes([]);
        });
    }

}