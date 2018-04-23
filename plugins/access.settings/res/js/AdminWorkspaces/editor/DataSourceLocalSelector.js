import React from 'react'
import PydioApi from 'pydio/http/api'
import {ConfigServiceApi, RestListPeerFoldersRequest} from 'pydio/http/rest-api'
import {SelectField, TextField, MenuItem, FontIcon, AutoComplete, RefreshIndicator} from 'material-ui'
import debounce from 'lodash.debounce'
import LangUtils from 'pydio/util/lang'
import PathUtils from 'pydio/util/path'

class AutocompleteTree extends React.Component{

    constructor(props){
        super(props);
        this.debounced = debounce(this.loadValues.bind(this), 300);
        this.state = {searchText: props.value, value: props.value};
    }

    handleUpdateInput(searchText) {
        this.debounced();
        this.setState({searchText: searchText});
    }

    handleNewRequest(chosenValue) {
        let key;
        const {nodes} = this.state;
        if (chosenValue.key === undefined) {
            key = chosenValue;
            let ok = false;
            nodes.map(node => {
                if (node.Path === key) {
                    ok = true;
                }
            });
            if(!ok){
                nodes.map(node => {
                    if (node.Path.indexOf(key) === 0) {
                        key = node.Path;
                        ok = true;
                    }
                });
            }
            if(!ok) {
                return;
            }
        } else {
            key = chosenValue.key;
        }
        this.setState({value:key});
        this.props.onChange(key);
        this.loadValues(key);
    }

    componentWillMount(){
        this.lastSearch = null;
        let value = "";
        if(this.props.value){
            value = this.props.value;
        }
        this.loadValues(value);
    }

    baseIsInvalid(path) {
        const base = PathUtils.getBasename(path);
        const dir = PathUtils.getDirname(path);
        let invalid = false;
        if(LangUtils.computeStringSlug(base) !== base) {
            invalid = true;
        }
        return {invalid, dir, base};

    }

    loadValues(value = "") {
        const {peerAddress} = this.props;
        const {searchText} = this.state;

        let basePath = value;
        if (!value && searchText){
            let last = searchText.lastIndexOf('/');
            basePath = searchText.substr(0, last);
        }
        if(this.lastSearch !== null && this.lastSearch === basePath){
            return;
        }
        this.lastSearch = basePath;
        const api = new ConfigServiceApi(PydioApi.getRestClient());
        let listRequest = new RestListPeerFoldersRequest();
        listRequest.PeerAddress = peerAddress;
        listRequest.Path = basePath;
        this.setState({loading: true});
        api.listPeerFolders(peerAddress, listRequest).then(nodesColl => {
            this.setState({nodes: nodesColl.Children || [], loading: false});
        }).catch(() => {
            this.setState({loading: false});
        })
    }

    renderNode(node) {
        const base = PathUtils.getBasename(node.Path);
        const dir = PathUtils.getDirname(node.Path);
        let label = <span>{node.Path}</span>;
        let invalid = false;
        if(LangUtils.computeStringSlug(base) !== base) {
            label = <span><span>{dir}</span>/<span style={{color:'#c62828'}}>{base}</span></span>
        }
        return {
            key         : node.Path,
            text        : node.Path,
            invalid     : invalid,
            value       : <MenuItem><FontIcon className={"mdi mdi-folder"} color="#616161" style={{float:'left',marginRight:8}}/> {label}</MenuItem>
        };
    }

    render(){

        const {nodes, loading} = this.state;
        let dataSource = [];
        if (nodes){
            nodes.forEach((node) => {
                dataSource.push(this.renderNode(node));
            });
        }

        let displayText = this.state.value;
        const {invalid, dir, base} = this.baseIsInvalid(displayText);

        return (
            <div style={{position:'relative', marginTop: -5}}>
                <div style={{position:'absolute', right: 0, top: 30, width: 30}}>
                <RefreshIndicator
                    size={30}
                    left={0}
                    top={0}
                    status={loading ? "loading" : "hide"}
                />
                </div>
                <AutoComplete
                    fullWidth={true}
                    searchText={displayText}
                    onUpdateInput={this.handleUpdateInput.bind(this)}
                    onNewRequest={this.handleNewRequest.bind(this)}
                    dataSource={dataSource}
                    floatingLabelText={invalid?'Last folder is exposed as an S3 bucket and must comply to DNS names!':'Pick a folder'}
                    floatingLabelStyle={invalid?{color:'#c62828'}:{}}
                    floatingLabelFixed={true}
                    filter={(searchText, key) => (key.toLowerCase().indexOf(searchText.toLowerCase()) === 0)}
                    openOnFocus={true}
                    menuProps={{maxHeight: 200}}
                />
            </div>

        );
    }

}

class DataSourceLocalSelector extends React.Component{

    constructor(props){
        super(props);
        this.state = {
            peerAddresses : [],
        }
    }

    componentDidMount(){
        const api = new ConfigServiceApi(PydioApi.getRestClient());
        api.listPeersAddresses().then(res => {
            this.setState({peerAddresses: res.PeerAddresses});
        })
    }

    render(){

        const {model} = this.props;
        const {peerAddresses} = this.state;

        return (
            <div style={{display:'flex', alignItems:'center'}}>
                <div style={{width: 180, marginRight: 10}}>
                    <SelectField
                        value={model.PeerAddress || ''}
                        floatingLabelFixed={true}
                        floatingLabelText={"Peer Address"}
                        onChange={(e,i,v) => {model.PeerAddress = v}}
                        fullWidth={true}
                    >
                        {peerAddresses.map(address => {
                            return <MenuItem value={address} primaryText={address}/>
                        })}
                    </SelectField>
                </div>
                <div style={{flex: 1}}>
                    {model.PeerAddress &&
                        <AutocompleteTree value={model.StorageConfiguration.folder} peerAddress={model.PeerAddress} onChange={(newValue)=>{model.StorageConfiguration.folder = newValue}}/>
                    }
                    {!model.PeerAddress &&
                        <TextField style={{marginTop: -3}} fullWidth={true} disabled={true} value={model.StorageConfiguration.folder} floatingLabelText={"Local folder"} floatingLabelFixed={true} hintText={"Please first select a peer to load folders list"}/>
                    }
                </div>
            </div>
        );

    }

}

export {DataSourceLocalSelector as default}