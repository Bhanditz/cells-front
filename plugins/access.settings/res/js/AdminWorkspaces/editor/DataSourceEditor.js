import React from 'react'
import DataSource from '../model/DataSource'
import {Dialog, Divider, Subheader, TextField, SelectField, Toggle, FlatButton, RaisedButton, MenuItem} from 'material-ui'
import DataSourceLocalSelector from './DataSourceLocalSelector'

class DataSourceEditor extends React.Component{

    constructor(props){
        super(props);
        const observable = new DataSource(props.dataSource);
        this.state = {
            dirty:false,
            create: props.create,
            observable: observable,
            model: observable.getModel(),
            loaded :false,
            valid: observable.isValid(),
            encryptionKeys: [],
            versioningPolicies: [],
        };
        DataSource.loadEncryptionKeys().then(res => {
            this.setState({encryptionKeys: res.Keys || []});
        });
        DataSource.loadVersioningPolicies().then(res => {
            this.setState({versioningPolicies: res.Policies || []});
        });
    }

    componentWillReceiveProps(newProps){
        if(newProps.dataSource && this.state.model.Name !== newProps.dataSource.Name){
            this.setState({model: new DataSource(newProps.dataSource).getModel()});
        }
        if(newProps.create && this.state.create !== newProps.create) {
            this.setState({create: newProps.create});
        }
    }

    componentDidMount(){
        const {observable} = this.state;
        observable.observe("update", () => {
            this.setState({dirty: true});
            this.forceUpdate();
        });
    }

    componentWillUnmount() {
        const {observable} = this.state;
        observable.stopObserving("update");
    }

    resetForm(){
        const {observable} = this.state;
        const newModel = observable.revert();
        this.setState({
            valid: true,
            dirty: false,
            model: newModel
        }, ()=>{this.forceUpdate()});
    }

    deleteSource(){
        if(confirm('Are you sure you want to delete this datasource? This is undoable, and you may loose all data linked to these nodes!')){
            this.state.observable.deleteSource().then(() => {
                this.props.closeEditor();
                this.props.reloadList();
            });
        }
    }

    saveSource(){
        this.state.observable.saveSource().then(() => {
            this.setState({valid: true, dirty: false, create: false});
            this.props.reloadList();
        });
    }

    launchResync(){
        this.state.observable.resyncSource();
    }

    toggleEncryption(value){
        if(value){
            this.setState({showDialog:'enableEncryption', dialogTargetValue: value});
        } else {
            this.setState({showDialog:'disableEncryption', dialogTargetValue: value});
        }
    }

    confirmEncryption(value){
        const {model} = this.state;
        model.EncryptionMode = (value?"MASTER":"CLEAR");
        this.setState({showDialog: false, dialogTargetValue: null});
    }

    render(){
        const {model, create, observable, encryptionKeys, versioningPolicies, showDialog, dialogTargetValue} = this.state;

        let titleActionBarButtons = [];
        if(!create){
            titleActionBarButtons.push(<FlatButton key="reset" label={this.context.getMessage('plugins.6')} onTouchTap={this.resetForm.bind(this)} secondary={true} disabled={!this.state.dirty}/>);
        }
        titleActionBarButtons.push(<FlatButton key="save" label={this.context.getMessage('53', '')} onTouchTap={this.saveSource.bind(this)} secondary={true} disabled={!observable.isValid() || !this.state.dirty}/>);
        titleActionBarButtons.push(<RaisedButton key="close" label={this.context.getMessage('86', '')} onTouchTap={this.props.closeEditor}/>);

        const leftNav = (
            <div style={{padding: '6px 0', color: '#9E9E9E', fontSize: 13}}>
                <div style={{fontSize: 120, textAlign:'center'}}>
                    <i className="mdi mdi-database"/>
                </div>
                <div style={{padding: 16}}>
                    {this.context.getMessage('ws.75')}
                    {this.context.getMessage('ws.76')}
                </div>
                {create && model.StorageType === 'LOCAL' &&
                <div>
                    <Divider/>
                    <div style={{padding: 16}}>
                        File System datasources serve files via an object storage server, that is starting on the <b>parent folder</b> and serving the target as an <b>s3 bucket</b>.
                        For this reason, the selected folder must meet the following requirements:
                        <ul>
                            <li style={{listStyle:'disc', marginLeft: 20}}>At least two-levels deep.</li>
                            <li style={{listStyle:'disc', marginLeft: 20}}>The parent must be writeable by the application service user</li>
                            <li style={{listStyle:'disc', marginLeft: 20}}>The target must comply with DNS names (lowercase, no spaces or special chars).</li>
                        </ul>
                    </div>
                </div>
                }
                {create && model.StorageType === 'S3' &&
                <div>
                    <Divider/>
                    <div style={{padding: 16}}>
                        Remote Storage datasources will serve files from a remote, s3-compatible storage by proxying all requests. <br/>
                        Use the standard API Key / Api Secret to authenticate, leave endpoint URL empty for AmazonS3 or use your storage URL for other on-premise solutions.
                    </div>
                </div>
                }
                {!create &&
                    <div>
                        <Divider/>
                        <div style={{padding: 16}}>
                            Resynchronization will scan the underlying storage and detect changes that are not currently
                            indexed in Pydio.
                            <div style={{textAlign:'center', marginTop: 10}}>
                                <RaisedButton label={"Re-Synchronize"} onClick={this.launchResync.bind(this)}/>
                            </div>
                        </div>
                    </div>
                }
                {!create &&
                    <div>
                        <Divider/>
                        <div style={{padding: 16}}>
                            Deleting datasource is a destructive operation : although it will NOT remove the data inside
                            the underlying storage, it will destroy existing index and unlink all ACLs linked to the indexed
                            nodes.
                            <br/>Make sure to first remove all workspaces that are pointing to this datasource before deleting it.
                            <div style={{textAlign:'center', marginTop: 10}}>
                                <RaisedButton secondary={true} label={"Delete DataSource"} onClick={this.deleteSource.bind(this)} style={{marginTop: 16}}/>
                            </div>
                        </div>
                    </div>
                }
            </div>
        );

        const title = model.Name ? "DataSource " + model.Name : 'New Data Source';
        let storageConfig = model.StorageConfiguration;
        const styles = {
            title: {
                fontSize: 20,
                paddingTop: 20,
                marginBottom: 0,
            },
            legend: {},
            section: {padding: '0 20px 20px'},
            toggleDiv:{height: 50, display:'flex', alignItems:'flex-end'}
        };

        return (
            <PydioComponents.PaperEditorLayout
                title={title}
                titleActionBar={titleActionBarButtons}
                leftNav={leftNav}
                className="workspace-editor"
                contentFill={false}
            >
                <Dialog
                    open={showDialog}
                    title={"Warning!"}
                    onRequestClose={()=>{this.confirmEncryption(!dialogTargetValue)}}
                    actions={[
                        <FlatButton label={"Cancel"} onTouchTap={()=>{this.confirmEncryption(!dialogTargetValue)}}/>,
                        <FlatButton label={"I Understand"} onTouchTap={()=>{this.confirmEncryption(dialogTargetValue)}}/>
                    ]}
                >
                    {showDialog === 'enableEncryption' &&
                        <div>
                            <p>Enabling encryption on a datasource will start cyphering the data on the storage using the encryption key you provide.</p>
                            <p>Please be aware that if you do not export and backup your master key, and if you have to reinstall the server for any reason, <b>all data will be lost!</b>.</p>
                            <p>You must also be aware that it may require more CPU for a smooth on-the-fly encrypting/decrypting of the data.</p>
                        </div>
                    }
                    {showDialog === 'disableEncryption' &&
                        <div>
                            If you have previously enabled encrytion on this datasource, all the encrypted data will be unreadable! Are you sure you want to do that?
                        </div>
                    }
                </Dialog>
                <div style={styles.section}>
                    <div style={styles.title}>Main Options</div>
                    <TextField fullWidth={true} floatingLabelFixed={true} floatingLabelText={"DataSource Identifier"} disabled={!create} value={model.Name} onChange={(e,v)=>{model.Name = v}}/>
                    {!create &&
                        <div style={styles.toggleDiv}><Toggle label={"Enabled"} toggled={!model.Disabled} onToggle={(e,v) =>{model.Disabled = !v}} /></div>
                    }
                    <TextField fullWidth={true} floatingLabelFixed={true} floatingLabelText={"Internal Port"} type={"number"} value={model.ObjectsPort} onChange={(e,v)=>{model.ObjectsPort = v}}/>
                </div>
                <Divider/>
                <div style={styles.section}>
                    <div style={styles.title}>Storage</div>
                    <SelectField fullWidth={true} floatingLabelText={"Storage Type"} value={model.StorageType} onChange={(e,i,v)=>{model.StorageType = v}}>
                        <MenuItem value={"LOCAL"} primaryText={"Local File System"}/>
                        <MenuItem value={"S3"} primaryText={"Remote Object Storage (S3)"}/>
                    </SelectField>
                    {model.StorageType === 'S3' &&
                        <div>
                            <TextField fullWidth={true}  floatingLabelFixed={true} floatingLabelText={"Bucket Name"} value={model.ObjectsBucket} onChange={(e,v)=>{model.ObjectsBucket = v}}/>
                            <TextField fullWidth={true} floatingLabelFixed={true} floatingLabelText={"S3 Api Key"} value={model.ApiKey} onChange={(e,v)=>{model.ApiKey = v}}/>
                            <TextField fullWidth={true} floatingLabelFixed={true} floatingLabelText={"S3 Api Secret"} value={model.ApiSecret} onChange={(e,v)=>{model.ApiSecret = v}}/>
                            <TextField fullWidth={true} floatingLabelFixed={true} floatingLabelText={"Internal Path"} value={model.ObjectsBaseFolder} onChange={(e,v)=>{model.ObjectsBaseFolder = v}}/>
                            <TextField fullWidth={true} floatingLabelFixed={true} floatingLabelText={"Custom Endpoint"} value={model.StorageConfiguration.customEndpoint} onChange={(e,v)=>{model.StorageConfiguration.customEndpoint = v}}/>
                        </div>
                    }
                    {model.StorageType === 'LOCAL' &&
                        <div>
                            <DataSourceLocalSelector model={model}/>
                            <div style={styles.toggleDiv}><Toggle label={"Storage is MacOS"} toggled={storageConfig.normalize === "true"} onToggle={(e,v)=>{storageConfig.normalize = (v?"true":"false")}}/></div>
                        </div>
                    }
                </div>
                <Divider/>
                <div style={styles.section}>
                    <div style={styles.title}>Data Management</div>
                    <SelectField fullWidth={true} floatingLabelFixed={true} floatingLabelText={"Versioning Policy"} value={model.VersioningPolicyName} onChange={(e,i,v)=>{model.VersioningPolicyName = v}}>
                        <MenuItem value={undefined} primaryText={"Do not enable versioning"}/>
                        {versioningPolicies.map(key => {
                            return <MenuItem value={key.Uuid} primaryText={key.Name}/>
                        })}
                    </SelectField>
                    <div style={styles.toggleDiv}><Toggle label={"Use Encryption"} toggled={model.EncryptionMode === "MASTER"} onToggle={(e,v)=>{this.toggleEncryption(v)}}/></div>
                    {model.EncryptionMode === "MASTER" &&
                        <SelectField fullWidth={true} floatingLabelFixed={true} floatingLabelText={"Encryption Key"} value={model.EncryptionKey} onChange={(e,i,v)=>{model.EncryptionKey = v}}>
                            {encryptionKeys.map(key => {
                                return <MenuItem value={key.ID} primaryText={key.Label}/>
                            })}
                        </SelectField>
                    }
                </div>

            </PydioComponents.PaperEditorLayout>
        );
    }
}

DataSourceEditor.contextTypes = {
    messages    : React.PropTypes.object,
    getMessage  : React.PropTypes.func
};

export {DataSourceEditor as default};