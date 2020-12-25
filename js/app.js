angular.module("pouchapp", ["ui.router"])

.run(['$pouchDB','$rootScope','$state','$location',function($pouchDB,$rootScope,$state,$location) {
    $pouchDB.setDatabase("myAngularApp");
    $rootScope.$state = $state;        
    var cnt = 0 ;
    $rootScope.$on('$stateChangeStart', function(event, toState, toParams, fromState, fromParams){    
        if  (toState.name !== 'login' || toState.name !== 'register' ){
            if(localStorage.getItem('user')==null)
                $location.url('/login');
            else
                $location.url('/list');
        }else{
            if(localStorage.getItem('user')==null)
                $location.url('/login');
            else
                $location.url('/list');
        }
      
    });
}])


.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider
        .state("list", {
            "url": "/list",
            "templateUrl": "templates/list.html",
            "controller": "MainController",
        })
        .state("login", {
            "url": "/login",
            "templateUrl": "templates/login.html",
            "controller": "MainController"
        })
        .state("register", {
            "url": "/register",
            "templateUrl": "templates/register.html",
            "controller": "MainController"
        })
        .state("item", {
            "url": "/item/:documentId/:documentRevision",
            "templateUrl": "templates/item.html",
            "controller": "MainController",
        });
    $urlRouterProvider.otherwise("login");
})

.controller("MainController", function($scope, $rootScope, $state, $stateParams, $pouchDB) {
    $scope.items = {};
    $scope.errors = [];
    $scope.messages = [];    
    $pouchDB.startListening();    
    // Listen for changes which include create or update events
    $rootScope.$on("$pouchDB:change", function(event, data) {
        $scope.items[data.doc._id] = data.doc;
        $scope.$apply();
    });

    // Listen for changes which include only delete events
    $rootScope.$on("$pouchDB:delete", function(event, data) {
        console.log($scope.items);
        delete $scope.items[data.doc._id];
        $scope.$apply();

    });

    // Look up a document if we landed in the info screen for editing a document
    if($stateParams.documentId) {
        $pouchDB.get($stateParams.documentId).then(function(result) {
            $scope.inputForm = result;
        });
    }
    var fd = new FormData();
    $scope.uploadFile = function(files) {        
          var fileReader1 = new FileReader();
          fileReader1.addEventListener("load", function () {        
          fd.append("file",fileReader1.result.split(',')[1]);
          fd.append("file_type",files[0].type);          
        }, false);
        
        fileReader1.readAsDataURL(files[0]);
        console.log(fd.get('file'));
    }
    $scope.go_register = function(){
        $state.go("register");
    }
    $scope.go_login = function(){
        $state.go("login");
    }
    $scope.logout = function () {        
        localStorage.removeItem('user');
        $state.go("login");
    }
    $scope.register = function(email,password) {
        $scope.messages = [];
        $scope.errors = [];
        var jsonDocument = {
            "type" : "users",
            "email": email,
            "password": password
        };
        // If we're updating, provide the most recent revision and document id
        $pouchDB.register(jsonDocument).then(function(response) {
            
            if (response.status==200) {
                $scope.messages = [response.message]               
            }else{
                $scope.errors = [response.message]                
            }
            //
        }, function(error) {
            console.log("ERROR -> " + error);
        });
    }    
    $scope.user = function(){
    //localStorage.setItem('user','mohit');
        if(localStorage.getItem('user'))
          return localStorage.getItem('user');
        else
          return false;
    }
    

    $scope.login = function(email,password) {
        console.log($scope.inputForm.$inval)
        $scope.messages = [];
        $scope.errors = [];
        var jsonDocument = {
            "type" : "users",
            "email": email,
            "password": password
        };
        // If we're updating, provide the most recent revision and document id
        $pouchDB.login(jsonDocument).then(function(response) {
            if (response.status==200) {                 
                localStorage.setItem('user',email);                
                
                $state.go("list");
            }else{
                $scope.errors = [response.message]                
            }
        }, function(error) {
            console.log("ERROR -> " + error);
        });
    }
    // Save a document with either an update or insert
    $scope.save = function(product_name, product_description, product_price) {

        var jsonDocument = {
            "type":"products",
            "product_name": product_name,
            "product_description": product_description,
            "product_price": product_price,
        };
        // If we're updating, provide the most recent revision and document id
        jsonImage = fd.get('file');
        if(fd.get('file')){
            jsonDocument['_attachments'] = {
                "file_name" : {
                    "content_type" : fd.get('file_type'),
                    "data" : fd.get('file')
                }
            }            
        }
        if($stateParams.documentId) {    
            jsonDocument["_id"] = $stateParams.documentId;
            jsonDocument["_rev"] = $stateParams.documentRevision;
        }
        $pouchDB.save(jsonDocument,jsonImage).then(function(response) {
            $state.go("list");
        }, function(error) {
            console.log("ERROR -> " + error);
        });
    }
    $scope.delete = function(id, rev) {
        if(confirm('Are you sure want to delete this record?'))
        $pouchDB.delete(id, rev);
        //$state.go("list"); 
    }
})

.service("$pouchDB", ["$rootScope", "$q", function($rootScope, $q) {

    var database;
    var changeListener;

    this.setDatabase = function(databaseName) {
        database = new PouchDB(databaseName);
    }

    this.startListening = function() {
            
        changeListener = database.changes({ 
            filter: function (doc) {
                return doc.type === 'products';
            },
            live: true,
            include_docs: true,
            attachments:true,
        }).on("change", function(change) {
            if(!change.deleted) {
                $rootScope.$broadcast("$pouchDB:change", change);
            } else {
                $rootScope.$broadcast("$pouchDB:delete", change);
            }
        });
    }

    this.stopListening = function() {
        changeListener.cancel();
    }

    this.sync = function(remoteDatabase) {
        database.sync(remoteDatabase, {live: true, retry: true});
    }

    this.register = function (jsonDocument) {
        var deferred = $q.defer();
        var map = function(doc) {
            if (doc.type === 'users') {
              emit(doc.email, null)
            }
        };
        database.query({map: map}, {key: jsonDocument.email}, function(err, res) {
            if(res.rows.length > 0){
                deferred.resolve({message:"User already exists",status:409});
            }else{
                database.post(jsonDocument,function(err,response){
                  if (response) {
                    deferred.resolve({message:"User created",status:200});
                  }
                });
            }           
        });                    
        return deferred.promise;
    }

    this.login = function (jsonDocument) {
        var deferred = $q.defer();
        var map = function(doc) {
            if (doc.type === 'users') {
              emit(doc.email, null)
            }
        };
        database.query({map: map}, {key: jsonDocument.email}, function(err, res) {
            if(res.rows.length > 0){
                database.get(res.rows[0].id, function(err, res) {
                    if (err) {
                        deferred.reject(err)
                    }else{
                        if (res.email==jsonDocument.email && res.password==jsonDocument.password) {
                            deferred.resolve({message:"Authenticate",status:200});                  
                        }else{
                            deferred.resolve({message:"Unauthenticate",status:401});                  
                        }    
                    }
                });                
            }else{
                database.post(jsonDocument,function(err,response){
                  if (response) {
                    deferred.resolve({message:"User not found",status:404});
                  }
                });
            }           
        });
        return deferred.promise;
    }

    this.save = function(jsonDocument) {
        var deferred = $q.defer();
        if(!jsonDocument._id) {
            database.post(jsonDocument).then(function(response) {
                deferred.resolve(response);
            }).catch(function(error) {
                deferred.reject(error);
            });

            
        } else {
            database.get(jsonDocument._id,{attachments:true}, function(err, doc) {
              if (err) { return console.log(err); }
              if (doc) {
                if (jsonImage==null || jsonImage=='') {
                    jsonDocument["_attachments"] = {                    
                        "file_name" : {
                            "content_type" : doc._attachments.file_name.content_type,
                            "data" : doc._attachments.file_name.data
                        }
                    }    
                }
                
                database.put(jsonDocument).then(function(response) {
                    deferred.resolve(response);
                }).catch(function(error) {
                    deferred.reject(error);
                });
                
              }
            });
        }
        return deferred.promise;
    }

    this.delete = function(documentId, documentRevision) {
        return database.remove(documentId, documentRevision);
    }

    this.get = function(documentId) {
        return database.get(documentId);
    }

    this.destroy = function() {
        database.destroy();
    }

}]);
