(function(global){

    var sendEventToUploader = function(items, files, el){

        var passItems, contextNode;
        if (items.length && items[0] && (items[0].getAsEntry || items[0].webkitGetAsEntry)) {
            passItems = items;
        }
        if(el.ajxpNode) {
            contextNode = el.ajxpNode;
        } else {
            contextNode = pydio.getContextHolder().getContextNode();
        }
        UploaderModel.Store.getInstance().handleDropEventResults(passItems, files, contextNode);
        if(!UploaderModel.Store.getInstance().getAutoStart()){
            pydio.getController().fireAction('upload');
        }

    };

    var createWorkspaceMenu = function(event, items, files, el){

        let targetNode = new AjxpNode('/', false, '');
        let data = [];
        let uploaderStore = UploaderModel.Store.getInstance();
        uploaderStore.handleDropEventResults(items, files, targetNode, data);

        let menuItems = [];
        global.pydio.user.getRepositoriesList().forEach(function(repository){

            if (Repository.isInternal(repository.getId()) || !repository.allowCrossRepositoryCopy) return;
            if (repository.hasContentFilter() || repository.getOwner()) return;
            if (repository.getAccessStatus() === 'declined') return;

            let repoId = repository.getId();
            menuItems.push({
                name:repository.getLabel(),
                alt:repository.getDescription(),
                icon_class:'mdi mdi-upload',
                callback: function(e){
                    data.forEach(function(item){
                        item.updateRepositoryId(repoId);
                        if(item instanceof UploaderModel.FolderItem) uploaderStore.pushFolder(item);
                        else uploaderStore.pushFile(item);
                    });
                }
            });
        });

        let contextMenu = new Proto.Menu({
            menuTitle:global.pydio.MessageHash['user_home.78'],
            selector: '', // context menu will be shown when element with class name of "contextmenu" is clicked
            className: 'menu desktop home_upload', // this is a class which will be attached to menu container (used for css styling)
            menuItems: menuItems,
            fade:false,
            zIndex:2000,
            forceCheckHeight:true
        });
        contextMenu.show(event);

    };

    var initialized = false;

    var ns = global.UploaderGlobalListener || {};
    ns.initUploaderExtension = function(){};
    global.UploaderGlobalListener = ns;

})(window);