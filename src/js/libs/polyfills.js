/* http://x-tags.org/download?byob=,WeakMap,MutationObserver,domtokenlist-polyfill,customelements-polyfill,htmlimports-polyfill */ 
if (typeof WeakMap === "undefined") {
    (function() {
        var defineProperty = Object.defineProperty;
        var counter = Date.now() % 1e9;
        var WeakMap = function() {
            this.name = "__st" + (Math.random() * 1e9 >>> 0) + (counter++ + "__");
        };
        WeakMap.prototype = {
            set: function(key, value) {
                var entry = key[this.name];
                if (entry && entry[0] === key) entry[1] = value; else defineProperty(key, this.name, {
                    value: [ key, value ],
                    writable: true
                });
            },
            get: function(key) {
                var entry;
                return (entry = key[this.name]) && entry[0] === key ? entry[1] : undefined;
            },
            "delete": function(key) {
                this.set(key, undefined);
            }
        };
        window.WeakMap = WeakMap;
    })();
}
(function(global) {
    var registrationsTable = new WeakMap();
    var setImmediate = window.msSetImmediate;
    if (!setImmediate) {
        var setImmediateQueue = [];
        var sentinel = String(Math.random());
        window.addEventListener("message", function(e) {
            if (e.data === sentinel) {
                var queue = setImmediateQueue;
                setImmediateQueue = [];
                queue.forEach(function(func) {
                    func();
                });
            }
        });
        setImmediate = function(func) {
            setImmediateQueue.push(func);
            window.postMessage(sentinel, "*");
        };
    }
    var isScheduled = false;
    var scheduledObservers = [];
    function scheduleCallback(observer) {
        scheduledObservers.push(observer);
        if (!isScheduled) {
            isScheduled = true;
            setImmediate(dispatchCallbacks);
        }
    }
    function wrapIfNeeded(node) {
        return window.ShadowDOMPolyfill && window.ShadowDOMPolyfill.wrapIfNeeded(node) || node;
    }
    function dispatchCallbacks() {
        isScheduled = false;
        var observers = scheduledObservers;
        scheduledObservers = [];
        observers.sort(function(o1, o2) {
            return o1.uid_ - o2.uid_;
        });
        var anyNonEmpty = false;
        observers.forEach(function(observer) {
            var queue = observer.takeRecords();
            removeTransientObserversFor(observer);
            if (queue.length) {
                observer.callback_(queue, observer);
                anyNonEmpty = true;
            }
        });
        if (anyNonEmpty) dispatchCallbacks();
    }
    function removeTransientObserversFor(observer) {
        observer.nodes_.forEach(function(node) {
            var registrations = registrationsTable.get(node);
            if (!registrations) return;
            registrations.forEach(function(registration) {
                if (registration.observer === observer) registration.removeTransientObservers();
            });
        });
    }
    function forEachAncestorAndObserverEnqueueRecord(target, callback) {
        for (var node = target; node; node = node.parentNode) {
            var registrations = registrationsTable.get(node);
            if (registrations) {
                for (var j = 0; j < registrations.length; j++) {
                    var registration = registrations[j];
                    var options = registration.options;
                    if (node !== target && !options.subtree) continue;
                    var record = callback(options);
                    if (record) registration.enqueue(record);
                }
            }
        }
    }
    var uidCounter = 0;
    function JsMutationObserver(callback) {
        this.callback_ = callback;
        this.nodes_ = [];
        this.records_ = [];
        this.uid_ = ++uidCounter;
    }
    JsMutationObserver.prototype = {
        observe: function(target, options) {
            target = wrapIfNeeded(target);
            if (!options.childList && !options.attributes && !options.characterData || options.attributeOldValue && !options.attributes || options.attributeFilter && options.attributeFilter.length && !options.attributes || options.characterDataOldValue && !options.characterData) {
                throw new SyntaxError();
            }
            var registrations = registrationsTable.get(target);
            if (!registrations) registrationsTable.set(target, registrations = []);
            var registration;
            for (var i = 0; i < registrations.length; i++) {
                if (registrations[i].observer === this) {
                    registration = registrations[i];
                    registration.removeListeners();
                    registration.options = options;
                    break;
                }
            }
            if (!registration) {
                registration = new Registration(this, target, options);
                registrations.push(registration);
                this.nodes_.push(target);
            }
            registration.addListeners();
        },
        disconnect: function() {
            this.nodes_.forEach(function(node) {
                var registrations = registrationsTable.get(node);
                for (var i = 0; i < registrations.length; i++) {
                    var registration = registrations[i];
                    if (registration.observer === this) {
                        registration.removeListeners();
                        registrations.splice(i, 1);
                        break;
                    }
                }
            }, this);
            this.records_ = [];
        },
        takeRecords: function() {
            var copyOfRecords = this.records_;
            this.records_ = [];
            return copyOfRecords;
        }
    };
    function MutationRecord(type, target) {
        this.type = type;
        this.target = target;
        this.addedNodes = [];
        this.removedNodes = [];
        this.previousSibling = null;
        this.nextSibling = null;
        this.attributeName = null;
        this.attributeNamespace = null;
        this.oldValue = null;
    }
    function copyMutationRecord(original) {
        var record = new MutationRecord(original.type, original.target);
        record.addedNodes = original.addedNodes.slice();
        record.removedNodes = original.removedNodes.slice();
        record.previousSibling = original.previousSibling;
        record.nextSibling = original.nextSibling;
        record.attributeName = original.attributeName;
        record.attributeNamespace = original.attributeNamespace;
        record.oldValue = original.oldValue;
        return record;
    }
    var currentRecord, recordWithOldValue;
    function getRecord(type, target) {
        return currentRecord = new MutationRecord(type, target);
    }
    function getRecordWithOldValue(oldValue) {
        if (recordWithOldValue) return recordWithOldValue;
        recordWithOldValue = copyMutationRecord(currentRecord);
        recordWithOldValue.oldValue = oldValue;
        return recordWithOldValue;
    }
    function clearRecords() {
        currentRecord = recordWithOldValue = undefined;
    }
    function recordRepresentsCurrentMutation(record) {
        return record === recordWithOldValue || record === currentRecord;
    }
    function selectRecord(lastRecord, newRecord) {
        if (lastRecord === newRecord) return lastRecord;
        if (recordWithOldValue && recordRepresentsCurrentMutation(lastRecord)) return recordWithOldValue;
        return null;
    }
    function Registration(observer, target, options) {
        this.observer = observer;
        this.target = target;
        this.options = options;
        this.transientObservedNodes = [];
    }
    Registration.prototype = {
        enqueue: function(record) {
            var records = this.observer.records_;
            var length = records.length;
            if (records.length > 0) {
                var lastRecord = records[length - 1];
                var recordToReplaceLast = selectRecord(lastRecord, record);
                if (recordToReplaceLast) {
                    records[length - 1] = recordToReplaceLast;
                    return;
                }
            } else {
                scheduleCallback(this.observer);
            }
            records[length] = record;
        },
        addListeners: function() {
            this.addListeners_(this.target);
        },
        addListeners_: function(node) {
            var options = this.options;
            if (options.attributes) node.addEventListener("DOMAttrModified", this, true);
            if (options.characterData) node.addEventListener("DOMCharacterDataModified", this, true);
            if (options.childList) node.addEventListener("DOMNodeInserted", this, true);
            if (options.childList || options.subtree) node.addEventListener("DOMNodeRemoved", this, true);
        },
        removeListeners: function() {
            this.removeListeners_(this.target);
        },
        removeListeners_: function(node) {
            var options = this.options;
            if (options.attributes) node.removeEventListener("DOMAttrModified", this, true);
            if (options.characterData) node.removeEventListener("DOMCharacterDataModified", this, true);
            if (options.childList) node.removeEventListener("DOMNodeInserted", this, true);
            if (options.childList || options.subtree) node.removeEventListener("DOMNodeRemoved", this, true);
        },
        addTransientObserver: function(node) {
            if (node === this.target) return;
            this.addListeners_(node);
            this.transientObservedNodes.push(node);
            var registrations = registrationsTable.get(node);
            if (!registrations) registrationsTable.set(node, registrations = []);
            registrations.push(this);
        },
        removeTransientObservers: function() {
            var transientObservedNodes = this.transientObservedNodes;
            this.transientObservedNodes = [];
            transientObservedNodes.forEach(function(node) {
                this.removeListeners_(node);
                var registrations = registrationsTable.get(node);
                for (var i = 0; i < registrations.length; i++) {
                    if (registrations[i] === this) {
                        registrations.splice(i, 1);
                        break;
                    }
                }
            }, this);
        },
        handleEvent: function(e) {
            e.stopImmediatePropagation();
            switch (e.type) {
              case "DOMAttrModified":
                var name = e.attrName;
                var namespace = e.relatedNode.namespaceURI;
                var target = e.target;
                var record = new getRecord("attributes", target);
                record.attributeName = name;
                record.attributeNamespace = namespace;
                var oldValue = e.attrChange === MutationEvent.ADDITION ? null : e.prevValue;
                forEachAncestorAndObserverEnqueueRecord(target, function(options) {
                    if (!options.attributes) return;
                    if (options.attributeFilter && options.attributeFilter.length && options.attributeFilter.indexOf(name) === -1 && options.attributeFilter.indexOf(namespace) === -1) {
                        return;
                    }
                    if (options.attributeOldValue) return getRecordWithOldValue(oldValue);
                    return record;
                });
                break;

              case "DOMCharacterDataModified":
                var target = e.target;
                var record = getRecord("characterData", target);
                var oldValue = e.prevValue;
                forEachAncestorAndObserverEnqueueRecord(target, function(options) {
                    if (!options.characterData) return;
                    if (options.characterDataOldValue) return getRecordWithOldValue(oldValue);
                    return record;
                });
                break;

              case "DOMNodeRemoved":
                this.addTransientObserver(e.target);

              case "DOMNodeInserted":
                var target = e.relatedNode;
                var changedNode = e.target;
                var addedNodes, removedNodes;
                if (e.type === "DOMNodeInserted") {
                    addedNodes = [ changedNode ];
                    removedNodes = [];
                } else {
                    addedNodes = [];
                    removedNodes = [ changedNode ];
                }
                var previousSibling = changedNode.previousSibling;
                var nextSibling = changedNode.nextSibling;
                var record = getRecord("childList", target);
                record.addedNodes = addedNodes;
                record.removedNodes = removedNodes;
                record.previousSibling = previousSibling;
                record.nextSibling = nextSibling;
                forEachAncestorAndObserverEnqueueRecord(target, function(options) {
                    if (!options.childList) return;
                    return record;
                });
            }
            clearRecords();
        }
    };
    global.JsMutationObserver = JsMutationObserver;
    if (!global.MutationObserver) global.MutationObserver = JsMutationObserver;
})(this);
(function() {
    if (typeof window.Element === "undefined" || "classList" in document.documentElement) return;
    var prototype = Array.prototype, indexOf = prototype.indexOf, slice = prototype.slice, push = prototype.push, splice = prototype.splice, join = prototype.join;
    function DOMTokenList(el) {
        this._element = el;
        if (el.className != this._classCache) {
            this._classCache = el.className;
            if (!this._classCache) return;
            var classes = this._classCache.replace(/^\s+|\s+$/g, "").split(/\s+/), i;
            for (i = 0; i < classes.length; i++) {
                push.call(this, classes[i]);
            }
        }
    }
    function setToClassName(el, classes) {
        el.className = classes.join(" ");
    }
    DOMTokenList.prototype = {
        add: function(token) {
            if (this.contains(token)) return;
            push.call(this, token);
            setToClassName(this._element, slice.call(this, 0));
        },
        contains: function(token) {
            return indexOf.call(this, token) !== -1;
        },
        item: function(index) {
            return this[index] || null;
        },
        remove: function(token) {
            var i = indexOf.call(this, token);
            if (i === -1) {
                return;
            }
            splice.call(this, i, 1);
            setToClassName(this._element, slice.call(this, 0));
        },
        toString: function() {
            return join.call(this, " ");
        },
        toggle: function(token) {
            if (indexOf.call(this, token) === -1) {
                this.add(token);
            } else {
                this.remove(token);
            }
        }
    };
    window.DOMTokenList = DOMTokenList;
    function defineElementGetter(obj, prop, getter) {
        if (Object.defineProperty) {
            Object.defineProperty(obj, prop, {
                get: getter
            });
        } else {
            obj.__defineGetter__(prop, getter);
        }
    }
    defineElementGetter(Element.prototype, "classList", function() {
        return new DOMTokenList(this);
    });
})();
if (!window.CustomElements) {
    window.CustomElements = {
        flags: {}
    };
}

(function(scope) {
    var logFlags = window.logFlags || {};
    var IMPORT_LINK_TYPE = window.HTMLImports ? HTMLImports.IMPORT_LINK_TYPE : "none";
    function findAll(node, find, data) {
        var e = node.firstElementChild;
        if (!e) {
            e = node.firstChild;
            while (e && e.nodeType !== Node.ELEMENT_NODE) {
                e = e.nextSibling;
            }
        }
        while (e) {
            if (find(e, data) !== true) {
                findAll(e, find, data);
            }
            e = e.nextElementSibling;
        }
        return null;
    }
    function forRoots(node, cb) {
        var root = node.shadowRoot;
        while (root) {
            forSubtree(root, cb);
            root = root.olderShadowRoot;
        }
    }
    function forSubtree(node, cb) {
        findAll(node, function(e) {
            if (cb(e)) {
                return true;
            }
            forRoots(e, cb);
        });
        forRoots(node, cb);
    }
    function added(node) {
        if (upgrade(node)) {
            insertedNode(node);
            return true;
        }
        inserted(node);
    }
    function addedSubtree(node) {
        forSubtree(node, function(e) {
            if (added(e)) {
                return true;
            }
        });
    }
    function addedNode(node) {
        return added(node) || addedSubtree(node);
    }
    function upgrade(node) {
        if (!node.__upgraded__ && node.nodeType === Node.ELEMENT_NODE) {
            var type = node.getAttribute("is") || node.localName;
            var definition = scope.registry[type];
            if (definition) {
                logFlags.dom && console.group("upgrade:", node.localName);
                scope.upgrade(node);
                logFlags.dom && console.groupEnd();
                return true;
            }
        }
    }
    function insertedNode(node) {
        inserted(node);
        if (inDocument(node)) {
            forSubtree(node, function(e) {
                inserted(e);
            });
        }
    }
    var hasPolyfillMutations = !window.MutationObserver || window.MutationObserver === window.JsMutationObserver;
    scope.hasPolyfillMutations = hasPolyfillMutations;
    var isPendingMutations = false;
    var pendingMutations = [];
    function deferMutation(fn) {
        pendingMutations.push(fn);
        if (!isPendingMutations) {
            isPendingMutations = true;
            var async = window.Platform && window.Platform.endOfMicrotask || setTimeout;
            async(takeMutations);
        }
    }
    function takeMutations() {
        isPendingMutations = false;
        var $p = pendingMutations;
        for (var i = 0, l = $p.length, p; i < l && (p = $p[i]); i++) {
            p();
        }
        pendingMutations = [];
    }
    function inserted(element) {
        if (hasPolyfillMutations) {
            deferMutation(function() {
                _inserted(element);
            });
        } else {
            _inserted(element);
        }
    }
    function _inserted(element) {
        if (element.attachedCallback || element.detachedCallback || element.__upgraded__ && logFlags.dom) {
            logFlags.dom && console.group("inserted:", element.localName);
            if (inDocument(element)) {
                element.__inserted = (element.__inserted || 0) + 1;
                if (element.__inserted < 1) {
                    element.__inserted = 1;
                }
                if (element.__inserted > 1) {
                    logFlags.dom && console.warn("inserted:", element.localName, "insert/remove count:", element.__inserted);
                } else if (element.attachedCallback) {
                    logFlags.dom && console.log("inserted:", element.localName);
                    element.attachedCallback();
                }
            }
            logFlags.dom && console.groupEnd();
        }
    }
    function removedNode(node) {
        removed(node);
        forSubtree(node, function(e) {
            removed(e);
        });
    }
    function removed(element) {
        if (hasPolyfillMutations) {
            deferMutation(function() {
                _removed(element);
            });
        } else {
            _removed(element);
        }
    }
    function _removed(element) {
        if (element.attachedCallback || element.detachedCallback || element.__upgraded__ && logFlags.dom) {
            logFlags.dom && console.group("removed:", element.localName);
            if (!inDocument(element)) {
                element.__inserted = (element.__inserted || 0) - 1;
                if (element.__inserted > 0) {
                    element.__inserted = 0;
                }
                if (element.__inserted < 0) {
                    logFlags.dom && console.warn("removed:", element.localName, "insert/remove count:", element.__inserted);
                } else if (element.detachedCallback) {
                    element.detachedCallback();
                }
            }
            logFlags.dom && console.groupEnd();
        }
    }
    function wrapIfNeeded(node) {
        return window.ShadowDOMPolyfill ? ShadowDOMPolyfill.wrapIfNeeded(node) : node;
    }
    function inDocument(element) {
        var p = element;
        var doc = wrapIfNeeded(document);
        while (p) {
            if (p == doc) {
                return true;
            }
            p = p.parentNode || p.host;
        }
    }
    function watchShadow(node) {
        if (node.shadowRoot && !node.shadowRoot.__watched) {
            logFlags.dom && console.log("watching shadow-root for: ", node.localName);
            var root = node.shadowRoot;
            while (root) {
                watchRoot(root);
                root = root.olderShadowRoot;
            }
        }
    }
    function watchRoot(root) {
        if (!root.__watched) {
            observe(root);
            root.__watched = true;
        }
    }
    function handler(mutations) {
        if (logFlags.dom) {
            var mx = mutations[0];
            if (mx && mx.type === "childList" && mx.addedNodes) {
                if (mx.addedNodes) {
                    var d = mx.addedNodes[0];
                    while (d && d !== document && !d.host) {
                        d = d.parentNode;
                    }
                    var u = d && (d.URL || d._URL || d.host && d.host.localName) || "";
                    u = u.split("/?").shift().split("/").pop();
                }
            }
            console.group("mutations (%d) [%s]", mutations.length, u || "");
        }
        mutations.forEach(function(mx) {
            if (mx.type === "childList") {
                forEach(mx.addedNodes, function(n) {
                    if (!n.localName) {
                        return;
                    }
                    addedNode(n);
                });
                forEach(mx.removedNodes, function(n) {
                    if (!n.localName) {
                        return;
                    }
                    removedNode(n);
                });
            }
        });
        logFlags.dom && console.groupEnd();
    }
    var observer = new MutationObserver(handler);
    function takeRecords() {
        handler(observer.takeRecords());
        takeMutations();
    }
    var forEach = Array.prototype.forEach.call.bind(Array.prototype.forEach);
    function observe(inRoot) {
        observer.observe(inRoot, {
            childList: true,
            subtree: true
        });
    }
    function observeDocument(doc) {
        observe(doc);
    }
    function upgradeDocument(doc) {
        logFlags.dom && console.group("upgradeDocument: ", doc.baseURI.split("/").pop());
        addedNode(doc);
        logFlags.dom && console.groupEnd();
    }
    function upgradeDocumentTree(doc) {
        doc = wrapIfNeeded(doc);
        var imports = doc.querySelectorAll("link[rel=" + IMPORT_LINK_TYPE + "]");
        for (var i = 0, l = imports.length, n; i < l && (n = imports[i]); i++) {
            if (n.import && n.import.__parsed) {
                upgradeDocumentTree(n.import);
            }
        }
        upgradeDocument(doc);
    }
    scope.IMPORT_LINK_TYPE = IMPORT_LINK_TYPE;
    scope.watchShadow = watchShadow;
    scope.upgradeDocumentTree = upgradeDocumentTree;
    scope.upgradeAll = addedNode;
    scope.upgradeSubtree = addedSubtree;
    scope.insertedNode = insertedNode;
    scope.observeDocument = observeDocument;
    scope.upgradeDocument = upgradeDocument;
    scope.takeRecords = takeRecords;
})(window.CustomElements);

(function(scope) {
    if (!scope) {
        scope = window.CustomElements = {
            flags: {}
        };
    }
    var flags = scope.flags;
    var hasNative = Boolean(document.registerElement);
    var useNative = !flags.register && hasNative && !window.ShadowDOMPolyfill;
    if (useNative) {
        var nop = function() {};
        scope.registry = {};
        scope.upgradeElement = nop;
        scope.watchShadow = nop;
        scope.upgrade = nop;
        scope.upgradeAll = nop;
        scope.upgradeSubtree = nop;
        scope.observeDocument = nop;
        scope.upgradeDocument = nop;
        scope.upgradeDocumentTree = nop;
        scope.takeRecords = nop;
        scope.reservedTagList = [];
    } else {
        function register(name, options) {
            var definition = options || {};
            if (!name) {
                throw new Error("document.registerElement: first argument `name` must not be empty");
            }
            if (name.indexOf("-") < 0) {
                throw new Error("document.registerElement: first argument ('name') must contain a dash ('-'). Argument provided was '" + String(name) + "'.");
            }
            if (isReservedTag(name)) {
                throw new Error("Failed to execute 'registerElement' on 'Document': Registration failed for type '" + String(name) + "'. The type name is invalid.");
            }
            if (getRegisteredDefinition(name)) {
                throw new Error("DuplicateDefinitionError: a type with name '" + String(name) + "' is already registered");
            }
            if (!definition.prototype) {
                throw new Error("Options missing required prototype property");
            }
            definition.__name = name.toLowerCase();
            definition.lifecycle = definition.lifecycle || {};
            definition.ancestry = ancestry(definition.extends);
            resolveTagName(definition);
            resolvePrototypeChain(definition);
            overrideAttributeApi(definition.prototype);
            registerDefinition(definition.__name, definition);
            definition.ctor = generateConstructor(definition);
            definition.ctor.prototype = definition.prototype;
            definition.prototype.constructor = definition.ctor;
            if (scope.ready) {
                scope.upgradeDocumentTree(document);
            }
            return definition.ctor;
        }
        function isReservedTag(name) {
            for (var i = 0; i < reservedTagList.length; i++) {
                if (name === reservedTagList[i]) {
                    return true;
                }
            }
        }
        var reservedTagList = [ "annotation-xml", "color-profile", "font-face", "font-face-src", "font-face-uri", "font-face-format", "font-face-name", "missing-glyph" ];
        function ancestry(extnds) {
            var extendee = getRegisteredDefinition(extnds);
            if (extendee) {
                return ancestry(extendee.extends).concat([ extendee ]);
            }
            return [];
        }
        function resolveTagName(definition) {
            var baseTag = definition.extends;
            for (var i = 0, a; a = definition.ancestry[i]; i++) {
                baseTag = a.is && a.tag;
            }
            definition.tag = baseTag || definition.__name;
            if (baseTag) {
                definition.is = definition.__name;
            }
        }
        function resolvePrototypeChain(definition) {
            if (!Object.__proto__) {
                var nativePrototype = HTMLElement.prototype;
                if (definition.is) {
                    var inst = document.createElement(definition.tag);
                    nativePrototype = Object.getPrototypeOf(inst);
                }
                var proto = definition.prototype, ancestor;
                while (proto && proto !== nativePrototype) {
                    var ancestor = Object.getPrototypeOf(proto);
                    proto.__proto__ = ancestor;
                    proto = ancestor;
                }
            }
            definition.native = nativePrototype;
        }
        function instantiate(definition) {
            return upgrade(domCreateElement(definition.tag), definition);
        }
        function upgrade(element, definition) {
            if (definition.is) {
                element.setAttribute("is", definition.is);
            }
            element.removeAttribute("unresolved");
            implement(element, definition);
            element.__upgraded__ = true;
            created(element);
            scope.insertedNode(element);
            scope.upgradeSubtree(element);
            return element;
        }
        function implement(element, definition) {
            if (Object.__proto__) {
                element.__proto__ = definition.prototype;
            } else {
                customMixin(element, definition.prototype, definition.native);
                element.__proto__ = definition.prototype;
            }
        }
        function customMixin(inTarget, inSrc, inNative) {
            var used = {};
            var p = inSrc;
            while (p !== inNative && p !== HTMLElement.prototype) {
                var keys = Object.getOwnPropertyNames(p);
                for (var i = 0, k; k = keys[i]; i++) {
                    if (!used[k]) {
                        Object.defineProperty(inTarget, k, Object.getOwnPropertyDescriptor(p, k));
                        used[k] = 1;
                    }
                }
                p = Object.getPrototypeOf(p);
            }
        }
        function created(element) {
            if (element.createdCallback) {
                element.createdCallback();
            }
        }
        function overrideAttributeApi(prototype) {
            if (prototype.setAttribute._polyfilled) {
                return;
            }
            var setAttribute = prototype.setAttribute;
            prototype.setAttribute = function(name, value) {
                changeAttribute.call(this, name, value, setAttribute);
            };
            var removeAttribute = prototype.removeAttribute;
            prototype.removeAttribute = function(name) {
                changeAttribute.call(this, name, null, removeAttribute);
            };
            prototype.setAttribute._polyfilled = true;
        }
        function changeAttribute(name, value, operation) {
            var oldValue = this.getAttribute(name);
            operation.apply(this, arguments);
            var newValue = this.getAttribute(name);
            if (this.attributeChangedCallback && newValue !== oldValue) {
                this.attributeChangedCallback(name, oldValue, newValue);
            }
        }
        var registry = {};
        function getRegisteredDefinition(name) {
            if (name) {
                return registry[name.toLowerCase()];
            }
        }
        function registerDefinition(name, definition) {
            registry[name] = definition;
        }
        function generateConstructor(definition) {
            return function() {
                return instantiate(definition);
            };
        }
        var HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
        function createElementNS(namespace, tag, typeExtension) {
            if (namespace === HTML_NAMESPACE) {
                return createElement(tag, typeExtension);
            } else {
                return domCreateElementNS(namespace, tag);
            }
        }
        function createElement(tag, typeExtension) {
            var definition = getRegisteredDefinition(typeExtension || tag);
            if (definition) {
                if (tag == definition.tag && typeExtension == definition.is) {
                    return new definition.ctor();
                }
                if (!typeExtension && !definition.is) {
                    return new definition.ctor();
                }
            }
            if (typeExtension) {
                var element = createElement(tag);
                element.setAttribute("is", typeExtension);
                return element;
            }
            var element = domCreateElement(tag);
            if (tag.indexOf("-") >= 0) {
                implement(element, HTMLElement);
            }
            return element;
        }
        function upgradeElement(element) {
            if (!element.__upgraded__ && element.nodeType === Node.ELEMENT_NODE) {
                var is = element.getAttribute("is");
                var definition = getRegisteredDefinition(is || element.localName);
                if (definition) {
                    if (is && definition.tag == element.localName) {
                        return upgrade(element, definition);
                    } else if (!is && !definition.extends) {
                        return upgrade(element, definition);
                    }
                }
            }
        }
        function cloneNode(deep) {
            var n = domCloneNode.call(this, deep);
            scope.upgradeAll(n);
            return n;
        }
        var domCreateElement = document.createElement.bind(document);
        var domCreateElementNS = document.createElementNS.bind(document);
        var domCloneNode = Node.prototype.cloneNode;
        document.registerElement = register;
        document.createElement = createElement;
        document.createElementNS = createElementNS;
        Node.prototype.cloneNode = cloneNode;
        scope.registry = registry;
        scope.upgrade = upgradeElement;
    }
    var isInstance;
    if (!Object.__proto__ && !useNative) {
        isInstance = function(obj, ctor) {
            var p = obj;
            while (p) {
                if (p === ctor.prototype) {
                    return true;
                }
                p = p.__proto__;
            }
            return false;
        };
    } else {
        isInstance = function(obj, base) {
            return obj instanceof base;
        };
    }
    scope.instanceof = isInstance;
    scope.reservedTagList = reservedTagList;
    document.register = document.registerElement;
    scope.hasNative = hasNative;
    scope.useNative = useNative;
})(window.CustomElements);

(function(scope) {
    var IMPORT_LINK_TYPE = scope.IMPORT_LINK_TYPE;
    var parser = {
        selectors: [ "link[rel=" + IMPORT_LINK_TYPE + "]" ],
        map: {
            link: "parseLink"
        },
        parse: function(inDocument) {
            if (!inDocument.__parsed) {
                inDocument.__parsed = true;
                var elts = inDocument.querySelectorAll(parser.selectors);
                forEach(elts, function(e) {
                    parser[parser.map[e.localName]](e);
                });
                CustomElements.upgradeDocument(inDocument);
                CustomElements.observeDocument(inDocument);
            }
        },
        parseLink: function(linkElt) {
            if (isDocumentLink(linkElt)) {
                this.parseImport(linkElt);
            }
        },
        parseImport: function(linkElt) {
            if (linkElt.import) {
                parser.parse(linkElt.import);
            }
        }
    };
    function isDocumentLink(inElt) {
        return inElt.localName === "link" && inElt.getAttribute("rel") === IMPORT_LINK_TYPE;
    }
    var forEach = Array.prototype.forEach.call.bind(Array.prototype.forEach);
    scope.parser = parser;
    scope.IMPORT_LINK_TYPE = IMPORT_LINK_TYPE;
})(window.CustomElements);

(function(scope) {
    function bootstrap() {
        CustomElements.parser.parse(document);
        CustomElements.upgradeDocument(document);
        var async = window.Platform && Platform.endOfMicrotask ? Platform.endOfMicrotask : setTimeout;
        async(function() {
            CustomElements.ready = true;
            CustomElements.readyTime = Date.now();
            if (window.HTMLImports) {
                CustomElements.elapsed = CustomElements.readyTime - HTMLImports.readyTime;
            }
            document.dispatchEvent(new CustomEvent("WebComponentsReady", {
                bubbles: true
            }));
            if (window.HTMLImports) {
                HTMLImports.__importsParsingHook = function(elt) {
                    CustomElements.parser.parse(elt.import);
                };
            }
        });
    }
    if (typeof window.CustomEvent !== "function") {
        window.CustomEvent = function(inType) {
            var e = document.createEvent("HTMLEvents");
            e.initEvent(inType, true, true);
            return e;
        };
    }
    if (document.readyState === "complete" || scope.flags.eager) {
        bootstrap();
    } else if (document.readyState === "interactive" && !window.attachEvent && (!window.HTMLImports || window.HTMLImports.ready)) {
        bootstrap();
    } else {
        var loadEvent = window.HTMLImports && !HTMLImports.ready ? "HTMLImportsLoaded" : "DOMContentLoaded";
        window.addEventListener(loadEvent, bootstrap);
    }
})(window.CustomElements);
window.HTMLImports = window.HTMLImports || {
    flags: {}
};

(function(scope) {
    var path = scope.path;
    var xhr = scope.xhr;
    var flags = scope.flags;
    var Loader = function(onLoad, onComplete) {
        this.cache = {};
        this.onload = onLoad;
        this.oncomplete = onComplete;
        this.inflight = 0;
        this.pending = {};
    };
    Loader.prototype = {
        addNodes: function(nodes) {
            this.inflight += nodes.length;
            for (var i = 0, l = nodes.length, n; i < l && (n = nodes[i]); i++) {
                this.require(n);
            }
            this.checkDone();
        },
        addNode: function(node) {
            this.inflight++;
            this.require(node);
            this.checkDone();
        },
        require: function(elt) {
            var url = elt.src || elt.href;
            elt.__nodeUrl = url;
            if (!this.dedupe(url, elt)) {
                this.fetch(url, elt);
            }
        },
        dedupe: function(url, elt) {
            if (this.pending[url]) {
                this.pending[url].push(elt);
                return true;
            }
            var resource;
            if (this.cache[url]) {
                this.onload(url, elt, this.cache[url]);
                this.tail();
                return true;
            }
            this.pending[url] = [ elt ];
            return false;
        },
        fetch: function(url, elt) {
            flags.load && console.log("fetch", url, elt);
            if (url.match(/^data:/)) {
                var pieces = url.split(",");
                var header = pieces[0];
                var body = pieces[1];
                if (header.indexOf(";base64") > -1) {
                    body = atob(body);
                } else {
                    body = decodeURIComponent(body);
                }
                setTimeout(function() {
                    this.receive(url, elt, null, body);
                }.bind(this), 0);
            } else {
                var receiveXhr = function(err, resource) {
                    this.receive(url, elt, err, resource);
                }.bind(this);
                xhr.load(url, receiveXhr);
            }
        },
        receive: function(url, elt, err, resource) {
            this.cache[url] = resource;
            var $p = this.pending[url];
            for (var i = 0, l = $p.length, p; i < l && (p = $p[i]); i++) {
                this.onload(url, p, resource);
                this.tail();
            }
            this.pending[url] = null;
        },
        tail: function() {
            --this.inflight;
            this.checkDone();
        },
        checkDone: function() {
            if (!this.inflight) {
                this.oncomplete();
            }
        }
    };
    xhr = xhr || {
        async: true,
        ok: function(request) {
            return request.status >= 200 && request.status < 300 || request.status === 304 || request.status === 0;
        },
        load: function(url, next, nextContext) {
            var request = new XMLHttpRequest();
            if (scope.flags.debug || scope.flags.bust) {
                url += "?" + Math.random();
            }
            request.open("GET", url, xhr.async);
            request.addEventListener("readystatechange", function(e) {
                if (request.readyState === 4) {
                    next.call(nextContext, !xhr.ok(request) && request, request.response || request.responseText, url);
                }
            });
            request.send();
            return request;
        },
        loadDocument: function(url, next, nextContext) {
            this.load(url, next, nextContext).responseType = "document";
        }
    };
    scope.xhr = xhr;
    scope.Loader = Loader;
})(window.HTMLImports);

(function(scope) {
    var IMPORT_LINK_TYPE = "import";
    var flags = scope.flags;
    var isIe = /Trident/.test(navigator.userAgent);
    var mainDoc = window.ShadowDOMPolyfill ? window.ShadowDOMPolyfill.wrapIfNeeded(document) : document;
    var importParser = {
        documentSelectors: "link[rel=" + IMPORT_LINK_TYPE + "]",
        importsSelectors: [ "link[rel=" + IMPORT_LINK_TYPE + "]", "link[rel=stylesheet]", "style", "script:not([type])", 'script[type="text/javascript"]' ].join(","),
        map: {
            link: "parseLink",
            script: "parseScript",
            style: "parseStyle"
        },
        parseNext: function() {
            var next = this.nextToParse();
            if (next) {
                this.parse(next);
            }
        },
        parse: function(elt) {
            if (this.isParsed(elt)) {
                flags.parse && console.log("[%s] is already parsed", elt.localName);
                return;
            }
            var fn = this[this.map[elt.localName]];
            if (fn) {
                this.markParsing(elt);
                fn.call(this, elt);
            }
        },
        markParsing: function(elt) {
            flags.parse && console.log("parsing", elt);
            this.parsingElement = elt;
        },
        markParsingComplete: function(elt) {
            elt.__importParsed = true;
            if (elt.__importElement) {
                elt.__importElement.__importParsed = true;
            }
            this.parsingElement = null;
            flags.parse && console.log("completed", elt);
            this.parseNext();
        },
        parseImport: function(elt) {
            elt.import.__importParsed = true;
            if (HTMLImports.__importsParsingHook) {
                HTMLImports.__importsParsingHook(elt);
            }
            if (elt.__resource) {
                elt.dispatchEvent(new CustomEvent("load", {
                    bubbles: false
                }));
            } else {
                elt.dispatchEvent(new CustomEvent("error", {
                    bubbles: false
                }));
            }
            if (elt.__pending) {
                var fn;
                while (elt.__pending.length) {
                    fn = elt.__pending.shift();
                    if (fn) {
                        fn({
                            target: elt
                        });
                    }
                }
            }
            this.markParsingComplete(elt);
        },
        parseLink: function(linkElt) {
            if (nodeIsImport(linkElt)) {
                this.parseImport(linkElt);
            } else {
                linkElt.href = linkElt.href;
                this.parseGeneric(linkElt);
            }
        },
        parseStyle: function(elt) {
            var src = elt;
            elt = cloneStyle(elt);
            elt.__importElement = src;
            this.parseGeneric(elt);
        },
        parseGeneric: function(elt) {
            this.trackElement(elt);
            document.head.appendChild(elt);
        },
        trackElement: function(elt, callback) {
            var self = this;
            var done = function(e) {
                if (callback) {
                    callback(e);
                }
                self.markParsingComplete(elt);
            };
            elt.addEventListener("load", done);
            elt.addEventListener("error", done);
            if (isIe && elt.localName === "style") {
                var fakeLoad = false;
                if (elt.textContent.indexOf("@import") == -1) {
                    fakeLoad = true;
                } else if (elt.sheet) {
                    fakeLoad = true;
                    var csr = elt.sheet.cssRules;
                    var len = csr ? csr.length : 0;
                    for (var i = 0, r; i < len && (r = csr[i]); i++) {
                        if (r.type === CSSRule.IMPORT_RULE) {
                            fakeLoad = fakeLoad && Boolean(r.styleSheet);
                        }
                    }
                }
                if (fakeLoad) {
                    elt.dispatchEvent(new CustomEvent("load", {
                        bubbles: false
                    }));
                }
            }
        },
        parseScript: function(scriptElt) {
            var script = document.createElement("script");
            script.__importElement = scriptElt;
            script.src = scriptElt.src ? scriptElt.src : generateScriptDataUrl(scriptElt);
            scope.currentScript = scriptElt;
            this.trackElement(script, function(e) {
                script.parentNode.removeChild(script);
                scope.currentScript = null;
            });
            document.head.appendChild(script);
        },
        nextToParse: function() {
            return !this.parsingElement && this.nextToParseInDoc(mainDoc);
        },
        nextToParseInDoc: function(doc, link) {
            var nodes = doc.querySelectorAll(this.parseSelectorsForNode(doc));
            for (var i = 0, l = nodes.length, p = 0, n; i < l && (n = nodes[i]); i++) {
                if (!this.isParsed(n)) {
                    if (this.hasResource(n)) {
                        return nodeIsImport(n) ? this.nextToParseInDoc(n.import, n) : n;
                    } else {
                        return;
                    }
                }
            }
            return link;
        },
        parseSelectorsForNode: function(node) {
            var doc = node.ownerDocument || node;
            return doc === mainDoc ? this.documentSelectors : this.importsSelectors;
        },
        isParsed: function(node) {
            return node.__importParsed;
        },
        hasResource: function(node) {
            if (nodeIsImport(node) && !node.import) {
                return false;
            }
            return true;
        }
    };
    function nodeIsImport(elt) {
        return elt.localName === "link" && elt.rel === IMPORT_LINK_TYPE;
    }
    function generateScriptDataUrl(script) {
        var scriptContent = generateScriptContent(script), b64;
        try {
            b64 = btoa(scriptContent);
        } catch (e) {
            b64 = btoa(unescape(encodeURIComponent(scriptContent)));
            console.warn("Script contained non-latin characters that were forced " + "to latin. Some characters may be wrong.", script);
        }
        return "data:text/javascript;base64," + b64;
    }
    function generateScriptContent(script) {
        return script.textContent + generateSourceMapHint(script);
    }
    function generateSourceMapHint(script) {
        var moniker = script.__nodeUrl;
        if (!moniker) {
            moniker = script.ownerDocument.baseURI;
            var tag = "[" + Math.floor((Math.random() + 1) * 1e3) + "]";
            var matches = script.textContent.match(/Polymer\(['"]([^'"]*)/);
            tag = matches && matches[1] || tag;
            moniker += "/" + tag + ".js";
        }
        return "\n//# sourceURL=" + moniker + "\n";
    }
    function cloneStyle(style) {
        var clone = style.ownerDocument.createElement("style");
        clone.textContent = style.textContent;
        path.resolveUrlsInStyle(clone);
        return clone;
    }
    var CSS_URL_REGEXP = /(url\()([^)]*)(\))/g;
    var CSS_IMPORT_REGEXP = /(@import[\s]+(?!url\())([^;]*)(;)/g;
    var path = {
        resolveUrlsInStyle: function(style) {
            var doc = style.ownerDocument;
            var resolver = doc.createElement("a");
            style.textContent = this.resolveUrlsInCssText(style.textContent, resolver);
            return style;
        },
        resolveUrlsInCssText: function(cssText, urlObj) {
            var r = this.replaceUrls(cssText, urlObj, CSS_URL_REGEXP);
            r = this.replaceUrls(r, urlObj, CSS_IMPORT_REGEXP);
            return r;
        },
        replaceUrls: function(text, urlObj, regexp) {
            return text.replace(regexp, function(m, pre, url, post) {
                var urlPath = url.replace(/["']/g, "");
                urlObj.href = urlPath;
                urlPath = urlObj.href;
                return pre + "'" + urlPath + "'" + post;
            });
        }
    };
    scope.parser = importParser;
    scope.path = path;
    scope.isIE = isIe;
})(HTMLImports);

(function(scope) {
    var hasNative = "import" in document.createElement("link");
    var useNative = hasNative;
    var flags = scope.flags;
    var IMPORT_LINK_TYPE = "import";
    var mainDoc = window.ShadowDOMPolyfill ? ShadowDOMPolyfill.wrapIfNeeded(document) : document;
    if (!useNative) {
        var xhr = scope.xhr;
        var Loader = scope.Loader;
        var parser = scope.parser;
        var importer = {
            documents: {},
            documentPreloadSelectors: "link[rel=" + IMPORT_LINK_TYPE + "]",
            importsPreloadSelectors: [ "link[rel=" + IMPORT_LINK_TYPE + "]" ].join(","),
            loadNode: function(node) {
                importLoader.addNode(node);
            },
            loadSubtree: function(parent) {
                var nodes = this.marshalNodes(parent);
                importLoader.addNodes(nodes);
            },
            marshalNodes: function(parent) {
                return parent.querySelectorAll(this.loadSelectorsForNode(parent));
            },
            loadSelectorsForNode: function(node) {
                var doc = node.ownerDocument || node;
                return doc === mainDoc ? this.documentPreloadSelectors : this.importsPreloadSelectors;
            },
            loaded: function(url, elt, resource) {
                flags.load && console.log("loaded", url, elt);
                elt.__resource = resource;
                if (isDocumentLink(elt)) {
                    var doc = this.documents[url];
                    if (!doc) {
                        doc = makeDocument(resource, url);
                        doc.__importLink = elt;
                        this.bootDocument(doc);
                        this.documents[url] = doc;
                    }
                    elt.import = doc;
                }
                parser.parseNext();
            },
            bootDocument: function(doc) {
                this.loadSubtree(doc);
                this.observe(doc);
                parser.parseNext();
            },
            loadedAll: function() {
                parser.parseNext();
            }
        };
        var importLoader = new Loader(importer.loaded.bind(importer), importer.loadedAll.bind(importer));
        function isDocumentLink(elt) {
            return isLinkRel(elt, IMPORT_LINK_TYPE);
        }
        function isLinkRel(elt, rel) {
            return elt.localName === "link" && elt.getAttribute("rel") === rel;
        }
        function isScript(elt) {
            return elt.localName === "script";
        }
        function makeDocument(resource, url) {
            var doc = resource;
            if (!(doc instanceof Document)) {
                doc = document.implementation.createHTMLDocument(IMPORT_LINK_TYPE);
            }
            doc._URL = url;
            var base = doc.createElement("base");
            base.setAttribute("href", url);
            if (!doc.baseURI) {
                doc.baseURI = url;
            }
            var meta = doc.createElement("meta");
            meta.setAttribute("charset", "utf-8");
            doc.head.appendChild(meta);
            doc.head.appendChild(base);
            if (!(resource instanceof Document)) {
                doc.body.innerHTML = resource;
            }
            if (window.HTMLTemplateElement && HTMLTemplateElement.bootstrap) {
                HTMLTemplateElement.bootstrap(doc);
            }
            return doc;
        }
    } else {
        var importer = {};
    }
    var currentScriptDescriptor = {
        get: function() {
            return HTMLImports.currentScript || document.currentScript;
        },
        configurable: true
    };
    Object.defineProperty(document, "_currentScript", currentScriptDescriptor);
    Object.defineProperty(mainDoc, "_currentScript", currentScriptDescriptor);
    if (!document.baseURI) {
        var baseURIDescriptor = {
            get: function() {
                return window.location.href;
            },
            configurable: true
        };
        Object.defineProperty(document, "baseURI", baseURIDescriptor);
        Object.defineProperty(mainDoc, "baseURI", baseURIDescriptor);
    }
    function whenImportsReady(callback, doc) {
        doc = doc || mainDoc;
        whenDocumentReady(function() {
            watchImportsLoad(callback, doc);
        }, doc);
    }
    var requiredReadyState = HTMLImports.isIE ? "complete" : "interactive";
    var READY_EVENT = "readystatechange";
    function isDocumentReady(doc) {
        return doc.readyState === "complete" || doc.readyState === requiredReadyState;
    }
    function whenDocumentReady(callback, doc) {
        if (!isDocumentReady(doc)) {
            var checkReady = function() {
                if (doc.readyState === "complete" || doc.readyState === requiredReadyState) {
                    doc.removeEventListener(READY_EVENT, checkReady);
                    whenDocumentReady(callback, doc);
                }
            };
            doc.addEventListener(READY_EVENT, checkReady);
        } else if (callback) {
            callback();
        }
    }
    function watchImportsLoad(callback, doc) {
        var imports = doc.querySelectorAll("link[rel=import]");
        var loaded = 0, l = imports.length;
        function checkDone(d) {
            if (loaded == l) {
                requestAnimationFrame(callback);
            }
        }
        function loadedImport(e) {
            loaded++;
            checkDone();
        }
        if (l) {
            for (var i = 0, imp; i < l && (imp = imports[i]); i++) {
                if (isImportLoaded(imp)) {
                    loadedImport.call(imp);
                } else {
                    imp.addEventListener("load", loadedImport);
                    imp.addEventListener("error", loadedImport);
                }
            }
        } else {
            checkDone();
        }
    }
    function isImportLoaded(link) {
        return useNative ? link.import && link.import.readyState !== "loading" : link.__importParsed;
    }
    scope.hasNative = hasNative;
    scope.useNative = useNative;
    scope.importer = importer;
    scope.whenImportsReady = whenImportsReady;
    scope.IMPORT_LINK_TYPE = IMPORT_LINK_TYPE;
    scope.isImportLoaded = isImportLoaded;
    scope.importLoader = importLoader;
})(window.HTMLImports);

(function(scope) {
    var IMPORT_LINK_TYPE = scope.IMPORT_LINK_TYPE;
    var importSelector = "link[rel=" + IMPORT_LINK_TYPE + "]";
    var importer = scope.importer;
    function handler(mutations) {
        for (var i = 0, l = mutations.length, m; i < l && (m = mutations[i]); i++) {
            if (m.type === "childList" && m.addedNodes.length) {
                addedNodes(m.addedNodes);
            }
        }
    }
    function addedNodes(nodes) {
        for (var i = 0, l = nodes.length, n; i < l && (n = nodes[i]); i++) {
            if (shouldLoadNode(n)) {
                importer.loadNode(n);
            }
            if (n.children && n.children.length) {
                addedNodes(n.children);
            }
        }
    }
    function shouldLoadNode(node) {
        return node.nodeType === 1 && matches.call(node, importer.loadSelectorsForNode(node));
    }
    var matches = HTMLElement.prototype.matches || HTMLElement.prototype.matchesSelector || HTMLElement.prototype.webkitMatchesSelector || HTMLElement.prototype.mozMatchesSelector || HTMLElement.prototype.msMatchesSelector;
    var observer = new MutationObserver(handler);
    function observe(root) {
        observer.observe(root, {
            childList: true,
            subtree: true
        });
    }
    scope.observe = observe;
    importer.observe = observe;
})(HTMLImports);

(function() {
    if (typeof window.CustomEvent !== "function") {
        window.CustomEvent = function(inType, dictionary) {
            var e = document.createEvent("HTMLEvents");
            e.initEvent(inType, dictionary.bubbles === false ? false : true, dictionary.cancelable === false ? false : true, dictionary.detail);
            return e;
        };
    }
    var doc = window.ShadowDOMPolyfill ? window.ShadowDOMPolyfill.wrapIfNeeded(document) : document;
    HTMLImports.whenImportsReady(function() {
        HTMLImports.ready = true;
        HTMLImports.readyTime = new Date().getTime();
        doc.dispatchEvent(new CustomEvent("HTMLImportsLoaded", {
            bubbles: true
        }));
    });
    if (!HTMLImports.useNative) {
        function bootstrap() {
            HTMLImports.importer.bootDocument(doc);
        }
        if (document.readyState === "complete" || document.readyState === "interactive" && !window.attachEvent) {
            bootstrap();
        } else {
            document.addEventListener("DOMContentLoaded", bootstrap);
        }
    }
})();
