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
import React from 'react'
import ShareContextConsumer from '../ShareContextConsumer'
import {Checkbox} from 'material-ui'
import LinkModel from './LinkModel'
import ShareHelper from '../main/ShareHelper'
import {RestShareLinkAccessType} from 'pydio/http/rest-api'

let PublicLinkPermissions = React.createClass({

    propTypes: {
        linkModel: React.PropTypes.instanceOf(LinkModel),
        style: React.PropTypes.object
    },

    changePermission: function(event){
        const name = event.target.name;
        const checked = event.target.checked;
        const link = this.props.linkModel.getLink();
        if(checked) {
            link.Permissions.push(RestShareLinkAccessType.constructFromObject(name));
        } else {
            link.Permissions = link.Permissions.filter((perm)=>{
                return (perm !== name);
            })
        }
        this.props.linkModel.updateLink(link);
    },

    render: function(){
        const {linkModel, compositeModel, pydio} = this.props;
        let perms = [], previewWarning;
        perms.push({
            NAME:'Preview',
            LABEL:this.props.getMessage('72'),
            DISABLED:!linkModel.hasPermission('Upload')
        });
        perms.push({
            NAME:'Download',
            LABEL:this.props.getMessage('73')
        });

        if(!compositeModel.getNode().isLeaf()){
            perms.push({
                NAME:'Upload',
                LABEL:this.props.getMessage('74')
            });
        }else if(ShareHelper.fileHasWriteableEditors(pydio, compositeModel.getNode())){
            perms.push({
                NAME:'Upload',
                LABEL:this.props.getMessage('74b')
            });
        }
        /*
        if(this.props.shareModel.isPublicLinkPreviewDisabled() && this.props.shareModel.getPublicLinkPermission(linkId, 'read')){
            previewWarning = <div>{this.props.getMessage('195')}</div>;
        }
        */
        return (
            <div style={{padding:'10px 16px', ...this.props.style}}>
                <div style={{fontSize:13, fontWeight:500, color:'rgba(0,0,0,0.43)'}}>{this.props.getMessage('70r')}</div>
                <div style={{margin:'10px 0 20px'}}>
                    {perms.map(function(p){
                        return (
                            <Checkbox
                                key={p.NAME}
                                disabled={p.DISABLED || this.props.isReadonly() || !linkModel.isEditable()}
                                type="checkbox"
                                name={p.NAME}
                                label={p.LABEL}
                                onCheck={this.changePermission}
                                checked={linkModel.hasPermission(p.NAME)}
                                labelStyle={{whiteSpace:'nowrap'}}
                                style={{margin:'10px 0'}}
                            />
                        );
                    }.bind(this))}
                    {previewWarning}
                </div>
            </div>
        );
    }
});

PublicLinkPermissions = ShareContextConsumer(PublicLinkPermissions);
export {PublicLinkPermissions as default}