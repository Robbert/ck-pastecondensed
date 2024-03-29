;(function() {

CKEDITOR.plugins.add('ck-pastecondensed', {
    init: function (editor) {
    
        // Listen after high priority (3) that will do 'MS Word paste' cleanup, but before content sniffing (6)
        var priority = 4;

        editor.on('paste', function (evt) {

            // Get the pasted content as HTML string
            var html = evt.data.dataValue;

            // Parse the HTML string as DOM using DOMPurify
            var dom = DOMPurify.sanitize(html, { RETURN_DOM: true });

            // DOMPurify.sanitize() will return the input untreated when the browser isn't supported
            if (dom === html)
                dom = HTML.parseFromString(html);


            PasteCondensed.condenseNode(dom);

            // Serialize the updated DOM as HTML, and update the event to pass it through
            evt.data.dataValue = HTML.getOuterHTML(dom);

        }, null, null, priority);
    }
});

/** @const {boolean} */
var DEBUG = false;

/** @const {boolean} */
var LOG = false;

// The `List`, `XML`, `DOM` and `StringPattern` are partial copies of modules from the repository of Robbert Broersma

var List = {};

/**
 * @param {(Array|Arguments|NamedNodeMap|NodeList)} arg
 * @return {Array}
 */
List.toArray = function (arg)
{
    var i = 0, l = arg.length, r = Array(l);
    for(; i < l; i++)
        r[i] = arg[i];
    return r;
};

/**
 * [CC] TODO @param {(function(*, number, Array): *)|((function(*, number): *)|(function(*): *))} fn
 *
 * @param {Array} arr
 * @param {!*} thisObj
 * @param {Function} callback
 */
List.forEach = function (arr, thisObj, callback)
{
    callback = /** @type {function(*, number, Array.<*>): *} */ (callback);

    var i = 0;

    /** @type {*} */
    var ctn;

    // Prevent infinite loop when length is Infinity
    var l = arr.length >>> 0;

    for (; i < l && ctn !== false; i++)
    {
        if (i in arr)
        {
            ctn = callback.call(thisObj, arr[i], i, arr)
        }
    }
};

/**
 * @param {Array} arg
 * @param {?*} thisObj
 * @param {Function} callback
 * @return {boolean}
 */
List.some = function (arg, thisObj, callback)
{
    callback = /** @type {function(*, number, Array.<*>): *} */ (callback);

    for (var i = 0, l = arg.length; i < l; i++)
    {
        if (callback.call(thisObj, arg[i], i, arg))
            return true;
    }
    return false;
};

/**
 * @param  {Array} arr
 * @param  {*} obj
 * @param  {number=} offset
 * @return {number}
 */
List.indexOf = function indexOf(arr, obj, offset)
{
    return arr.indexOf(obj, offset);
};

if (!("indexOf" in Array.prototype))
{
    /**
     * @param  {Array} arr
     * @param  {*} obj
     * @param  {number=} offset
     * @return {number}
     * @suppress {duplicate}
     */
    List.indexOf = function (arr, obj, offset)
    {
        for (var i = offset || 0, l = arr.length; i < l; i++)
        {
            if (arr[i] === obj)
                return i;
        }
        return -1;
    };
}

/**
 * @param  {Array} arr
 * @param  {*} obj
 * @return {boolean}
 */
List.contains = function indexOf_contains(arr, obj)
{
    return List.indexOf(arr, obj) !== -1;
};

var DOM = {};

/**
 * @const
 * @type {number}
 */
DOM.ELEMENT_NODE                   = 1;

/**
 * @const
 * @type {number}
 */
DOM.ATTRIBUTE_NODE                 = 2;

/**
 * @const
 * @type {number}
 */
DOM.TEXT_NODE                      = 3;

/**
 * @const
 * @type {number}
 */
DOM.CDATA_SECTION_NODE             = 4;

/**
 * @const
 * @type {number}
 */
DOM.ENTITY_REFERENCE_NODE          = 5;

/**
 * @const
 * @type {number}
 */
DOM.ENTITY_NODE                    = 6;

/**
 * @const
 * @type {number}
 */
DOM.PROCESSING_INSTRUCTION_NODE    = 7;

/**
 * @const
 * @type {number}
 */
DOM.COMMENT_NODE                   = 8;

/**
 * @const
 * @type {number}
 */
DOM.DOCUMENT_NODE                  = 9;

/**
 * @const
 * @type {number}
 */
DOM.DOCUMENT_TYPE_NODE             = 10;

/**
 * @const
 * @type {number}
 */
DOM.DOCUMENT_FRAGMENT_NODE         = 11;

/**
 * @const
 * @type {number}
 */
DOM.NOTATION_NODE                  = 12;

/**
 * @const
 * @type {number}
 */
DOM.NAMESPACE_NODE                 = 13;

/**
 * @const
 * @type {number}
 * @see http://www.w3.org/TR/2001/WD-DOM-Level-3-XPath-20010830/xpath.html#XPathNodeType
 */
DOM.XPATH_NAMESPACE_NODE           = 13;

/**
 * @param {?Node|Object} node
 * @return {boolean}
 */
DOM.isElement = function isElement(node)
{
    node = /** @type {?Node} */ (node);
    return node ? node.nodeType === DOM.ELEMENT_NODE : false;
};

/**
 * @param {?Node|Object} node
 * @return {boolean}
 */
DOM.isText = function isText(node)
{
    node = /** @type {?Node} */ (node);
    return node ? node.nodeType === DOM.TEXT_NODE || node.nodeType === DOM.CDATA_SECTION_NODE : false;
};

/**
 * Example:
 *   [a, b].forEach(DOM.removeNode);
 * 
 * @param  {Node} node
 */
DOM.removeNode = function (node)
{
    if (node.parentNode !== null)
        node.parentNode.removeChild(node);
};

/**
 * FIXME: an Attr as contextNode should work.
 * 
 * @param {Node} contextNode
 * @return {Array.<Node>}
 */
DOM.getAncestors = function (contextNode)
{
    var parentNode = contextNode,
        nodes = [],
        i = 0;
    
    while ((parentNode = parentNode.parentNode))
    {
        nodes[i++] = parentNode;
    }
    
    return nodes;
};

/**
 * @param  {Node} node
 * @return {Document}
 */
DOM.getDocument = function (node)
{
    if (node.nodeType === DOM.DOCUMENT_NODE)
    {
        node = /** @type {Document} */ (node);
    }
    else
    {
        node = node.ownerDocument;
    }
    return node;
};

/**
 * @param {Node} node
 * @return {boolean}
 */
DOM.unwrapBefore = function (node)
{
    return DOM.unwrapAdjacent(node, -1);
};

/**
 * @param {Node} node
 * @return {boolean}
 */
DOM.unwrapAfter = function (node)
{
    return DOM.unwrapAdjacent(node, 1);
};

/**
 * @param {Node} node
 * @param {number} direction 1 for moving to after the parent, -1 for moving to before the parent
 * @return {boolean}
 */
DOM.unwrapAdjacent = function (node, direction)
{
    var parent = node.parentNode;
    if (parent && parent.parentNode)
    {
        if (direction > 0)
        {
            parent.parentNode.insertBefore(node, parent.nextSibling);
            adjacent = node.nextSibling;
        }
        else if (direction < 0)
        {
            parent.parentNode.insertBefore(node, parent);
            adjacent = node.previousSibling;
        }

        var next = node.nextSibling;
        if (DOM.isText(next))
        {
            DOM.removeNode(node);

            if (direction > 0)
            {
                adjacent.insertData(0, node.nodeValue);
            }
            else if (direction < 0)
            {
                adjacent.appendData(node.nodeValue);
            }
        }
        return true;
    }
    return false;

};

var Character = {};

/**
 * @param {string} str
 * @return {string}
 */
Character.toLowerCase = function toLowerCase(str)
{
    return str.toLowerCase();
};

var Escaping = {};

/**
 * Escaping of the following characters using entities: & < > "
 * Also replace non-character ranges with the replacement character (U+FFFD)
 * 
 * @param {string} xml
 * @param {boolean=} attr When false, double quotes will not be escaped
 * @return {string}
 */
Escaping.escapeXML = function escapeXML(xml, attr)
{
    // @see http://www.w3.org/TR/REC-xml/#charsets
    // Escape the Unicode 'non-characters'
    // Escape characters below 0xC0 except tab and the newlines
    // Escape < to prevent starting an element
    // Escape > to prevent ending a CDATA section
    // Escape " to prevent ending an attribute
    // Escape & to prevent starting an entity reference
    // Don't escape surrogate blocks, because they are essential for Unicode support in JavaScript
    return xml.replace(/[\0-\t\u000B\u000C\u000E-\u00C0"&<>\uFFFE\uFFFF]/g, function(m) {
        var charCode = m.charCodeAt(0);

        if (charCode === 34 )//&& attr !== false)
            // One byte shorter than than &quot;
            m = "&#34;";

        else if (charCode === 38) // &
            m = "&amp;";

        // In a text node the > needn't be escaped,
        // but in CDATA sections it must be.
        else if (charCode === 62) // <
            m = "&gt;";

        else if (charCode === 60)
            m = "&lt;";
        
        else if (charCode < 32 || charCode === 0xFFFE || charCode === 0xFFFF)
            m = "\uFFFD";

        return m;
    });
};

/**
 * Escape consecutive dashes using a space
 * @private
 * @param {string} x
 * @return {string}
 */
Escaping.__escapeDash = function (x)
{
    return x.split("").join(" ");
};

/**
 * Escape consecutive dashes using a separating space
 * @param {string} data
 * @return {string}
 */
Escaping.escapeComment = function (data)
{
    return data.replace(/-{2,}/g, Escaping.__escapeDash);
};

/**
 * @param {string} data
 * @return {string}
 */
Escaping.escapeCDATA = function (data)
{
    // @see http://www.w3.org/TR/REC-xml/#charsets
    // Escape the Unicode 'non-characters'
    // Escape characters below 0xC0 except tab and the newlines
    // Don't escape surrogate blocks, because they are essential for Unicode support in JavaScript
    // Escape ]]> because those would end the CDATA section. Instead split content into two CDATA sections

    return data.replace(/[\0-\t\u000B\u000C\u000E-\u00C0\uFFFE\uFFFF]/g, "\uFFFD")
               .replace(/]]>/g, "]]]]><![CDATA[>");
};

var HTML = {};

/** @const {boolean} */
HTML.SUPPORT_DOM = true;

HTML.defaultDocument = document;

/**
 * @const
 * @type {boolean}
 */
HTML.FEATURE_IMPLEMENTATION = HTML.SUPPORT_DOM && ("implementation" in HTML.defaultDocument);

/**
 * @const
 * @type {boolean}
 */
HTML.FEATURE_CREATEDOCUMENT = HTML.FEATURE_IMPLEMENTATION && "createHTMLDocument" in HTML.defaultDocument.implementation;
    
/**
 * @const
 * @type {boolean}
 */
HTML.SUPPORT_ACTIVEX = HTML.SUPPORT_DOM && typeof ActiveXObject === "function";

/**
 * @param {(Element|Attr)} node
 * @return {string}
 */
HTML.getLocalName = function (node)
{
    var nodeType = node.nodeType,
        nodeName;
    if (nodeType === DOM.ELEMENT_NODE)
        nodeName = Character.toLowerCase(node.nodeName);
    else if (nodeType === DOM.ATTRIBUTE_NODE)
        nodeName = node.nodeName;
    else
        nodeName = null;
    return nodeName;
};

/**
 * innerHTML but better
 * 
 * @param {Node} node
 * @return {string}
 */
HTML.getInnerHTML = function (node)
{
    var nodeType = node.nodeType;

    if (typeof node.innerHTML === "string")
        return node.innerHTML;

    if (nodeType === DOM.ELEMENT_NODE || nodeType === DOM.DOCUMENT_NODE || nodeType === DOM.DOCUMENT_FRAGMENT_NODE)
    {
        var buffer = [];
        for (var i = 0, l = node.childNodes.length; i < l; i++)
        {
            buffer.push(HTML.getOuterHTML(node.childNodes[i]));
        }
        return buffer.join("");
    }
    
    return "";
};

/**
 * outerHTML but better
 * 
 * @see https://bugzilla.mozilla.org/show_bug.cgi?id=92264
 * 
 * @param {Node} node
 * @return {string}
 */
HTML.getOuterHTML = function (node)
{
    var nodeType = node.nodeType;

    if (typeof node.outerHTML === "string")
        return node.outerHTML;

    if (nodeType === DOM.ELEMENT_NODE)
    {
        var div = DOM.getDocument(node).createElement("div");
        div.appendChild(HTML.cloneNode(node, true));
        return div.innerHTML;
    }
    else if (nodeType === DOM.DOCUMENT_NODE || nodeType === DOM.DOCUMENT_FRAGMENT_NODE)
    {
        return HTML.getInnerHTML(node);
    }
    else if (nodeType === DOM.TEXT_NODE)
    {
        return Escaping.escapeXML(node.nodeValue);
    }
    else if (nodeType === DOM.COMMENT_NODE)
    {
        return "<!--" + Escaping.escapeComment(node.nodeValue) + "-->";
    }
    else if (nodeType === DOM.CDATA_SECTION_NODE)
    {
        return "<![CDATA[" + Escaping.escapeCDATA(node.nodeValue) + "]]>";
    }
    
    return "";
};

/**
 * @param {string} html
 * @return {Document}
 */
HTML.parseFromString = function (html)
{
    // TODO: This isn't supported in all browsers, detect this
    var doc = HTML.defaultDocument.implementation.createHTMLDocument('');
    doc.body.outerHTML = html;
    return doc;
};

/**
 * @param {string} html
 * @return {Document}
 */
HTML.parseFromString_ActiveX = function (html)
{
    var doc = new ActiveXObject("htmlfile");
    doc.open();
    doc.write(html);
    doc.close();
    return doc;
};

if (!HTML.FEATURE_CREATEDOCUMENT && HTML.SUPPORT_ACTIVEX)
{
    HTML.parseFromString = HTML.parseFromString_ActiveX;
}

var XML = {};

/**
 * @const
 * @type {string}
 */
XML.XMLNS_XHTML = "http://www.w3.org/1999/xhtml";

/** @const {RegExp} */
XML.WHITESPACE_TRIM_REGEXP = /^[ \n\r\t]+|[ \n\r\t]+$/g;

/** @const {RegExp} */
XML.WHITESPACE_REGEXP = /[ \n\r\t]+/g;

/** @const {RegExp} */
XML.ALL_WHITESPACE_REGEXP = /^[ \n\r\t]*$/

/**
 * @param {string} value
 * @return {boolean}
 */
XML.isWhitespace = function (value)
{
    return XML.ALL_WHITESPACE_REGEXP.test(value);
};

/**
 * @param {Node} node
 * @return {boolean}
 */
XML.hasChildNodes = function (node)
{
    return !!node.firstChild;
};
/**
 * @param {string} value
 * @return {string}
 */
XML.normalizeWhitespace = function (value)
{
    return value.replace(XML.WHITESPACE_TRIM_REGEXP, "").replace(XML.WHITESPACE_REGEXP, " ");
};


XML.toArray = List.toArray;

/**
 * @param {Element|Document|DocumentFragment} node
 * @return {Array.<Element>}
 * @suppress {duplicate}
 */
XML.getElements = function (node)
{
    var els;

    if (node.nodeType === DOM.DOCUMENT_FRAGMENT_NODE)
    {
        // DocumentFragment doesn't have `getElementsByTagName`,
        // use XPath instead.
        els = XML.getDescendants(node, DOM.isElement);
    }
    else if (node.nodeType === DOM.DOCUMENT_NODE || node.nodeType === DOM.ELEMENT_NODE)
    {
        els = XML.toArray(node.getElementsByTagName("*"));
    }
    else
    {
        els = [];
    }

    return els;
};

/**
 * @param {Node} node
 * @return {Node}
 */
XML.getPrecedingNode = function (node)
{
    var preceding = node.previousSibling;

    if (preceding)
    {
        while (preceding && (node = preceding.lastChild))
        {
            preceding = node;
        }
    }
    else
    {
        preceding = node.parentNode;
    }

    return preceding;
};

/**
 * @param {Node} node
 * @return {?Node}
 */
XML.getFollowingNode = function (node)
{
    var following = node.firstChild;

    if (!following)
    {
        following = node.nextSibling;
    }

    while (!following && (node = node.parentNode))
    {
        following = node.nextSibling;
    }

    return following;
};

/**
 * @param {Node} node
 * @return {boolean}
 */
XML.isParentNode = function isParentNode(node)
{
    var nodeType = node.nodeType;

    return nodeType === DOM.ELEMENT_NODE
        || nodeType === DOM.DOCUMENT_NODE
        || nodeType === DOM.DOCUMENT_FRAGMENT_NODE;
};

/**
 * @param {Node} node
 * @param {function(Node)=} filter
 * @return {Array.<Node>}
 */
XML.getDescendants = function getDescendants(node, filter)
{
    if (!(typeof filter === "function" || typeof filter === "undefined"))
        throw new TypeError();

    var descendants = [];
    var following = node;

    while ((following = XML.getFollowingNode(following)) && following.previousSibling !== node)
    {
        if (!filter || !!filter(following))
        {
            descendants.push(following);
        }
    }

    return descendants;
};

/**
 * @param {Node} node
 * @param {function(Node)=} filter
 * @return {Array.<Node>}
 */
XML.getDescendantsOrSelf = function getDescendantsOrSelf(node, filter)
{
    var list = XML.getDescendants(node, filter);
    if (!filter || filter(node))
        list.unshift(node);
    return list;
};

var StringPattern = {};

/**
 * @param {string} str
 * @param {RegExp} regexp
 * @return {Array.<string>}
 */
StringPattern.indexOf = function (str, regexp, offset)
{
    if (typeof offset !== "number")
        offset = 0;

    // if (!regexp.global)
        // regexp = StringPattern.makeGlobal(regexp);

    // Necessary when re-using RegExp objects
    regexp.lastIndex = offset;

    var index = -1;

    var match = null;
    if ((match = regexp.exec(str)) !== null)
        index = match.index;

    return index;
};

var PasteCondensed = {};

/**
 * @param {Node} node
 * @return {boolean}
 */
PasteCondensed.isPreformatted = function (node)
{
    var pre = false,
        nodeType = node.nodeType;
    
    if (nodeType === DOM.ELEMENT_NODE)
    {
        var namespaceURI = XML.XMLNS_XHTML, // HACK
            localName = HTML.getLocalName(node);

        if (namespaceURI === XML.XMLNS_XHTML)
        {
            pre = localName === 'pre'  ||
                  localName === 'code' ||
                  localName === 'samp' ||
                  localName === 'var';
        }
    }
    // Whitespace in CDATA, PIs and comments should be left untouched
    else if (nodeType === DOM.CDATA_SECTION_NODE ||
             nodeType === DOM.PROCESSING_INSTRUCTION_NODE ||
             nodeType === DOM.COMMENT_NODE)
    {
        pre = true;
    }

    return pre;
};

/**
 * @param {CharacterData} node
 * @return {boolean}
 */
PasteCondensed.isPreformattedCharacterData = function (node)
{
    return List.some(DOM.getAncestors(node), null, PasteCondensed.isPreformatted);
};

PasteCondensed.isWhitespaceElement = function (namespaceURI, name)
{
    if (namespaceURI === XML.XMLNS_XHTML)
    {
        return name === 'br';
    }

    return false;
};

/**
 * @param {?string} namespaceURI
 * @param {string} name
 * @return {boolean}
 */
PasteCondensed.isParagraphSplitter = function (namespaceURI, name)
{
    if (namespaceURI === XML.XMLNS_XHTML)
    {
        if (List.contains(["br", "hr"], name))
            return true;
    }

    return false;
};

/**
 * Identify nodes that should be oblique to traversing the tree for natural language text
 * 
 * @param {?string} namespaceURI
 * @param {string} name
 * @return {boolean}
 */
PasteCondensed.isNonPhrasingContent = function (namespaceURI, name)
{
    if (namespaceURI === XML.XMLNS_XHTML)
    {
        // <p>hello <comment>test</comment>world!</p>
        if (List.contains("comment", name))
            return true;
    }

    return false;
};

/**
 * @param {?string} namespaceURI
 * @param {string} name
 * @return {boolean}
 */
PasteCondensed.isBlockContainer = function (namespaceURI, localName)
{
    if (namespaceURI === XML.XMLNS_XHTML)
    {
        var x = [
            'p',
            'ol',
            'ul',
            'li',
            'dl',
            'dt',
            'dd',
            'figure',
            'figcaption',
            'main',
            'div'
        ];

        return List.contains(x, localName);
    }
};

/**
 * Return true for all elements that are inline elements and can contain another element and just text content
 * 
 * @return {boolean}
 */
PasteCondensed.isInlineContainer = function (namespaceURI, localName)
{
    var match = false;

    if (namespaceURI === XML.XMLNS_XHTML)
    {
        var x = [
            'a', // TODO: Maybe we should consider <a name=x></a> as non-empty?
            'em',
            'strong',
            'small',
            's',
            'cite',
            'q',
            'dfn',
            'abbr',
            'ruby',
            'rt',
            'rp',
            'data',
            'time',
            'code',
            'var',
            'samp',
            'kbd',
            'sub',
            'sup',
            'i',
            'b',
            'u',
            'mark',
            'bdi',
            'bdo',
            'span',
            'font'

            // The following inline HTML elements are not containers:
            // 'wbr',
            // 'br',
        ]

        match = List.contains(x, localName);
    }

    return match;
};

PasteCondensed.isInlineContainerElement = function (node)
{
    return node.nodeType === DOM.ELEMENT_NODE && PasteCondensed.isInlineContainer(XML.XMLNS_XHTML, HTML.getLocalName(node));
};

PasteCondensed.isPhraseContainer = function (node)
{
    if (node.nodeType === DOM.ELEMENT_NODE)
    {
        var namespaceURI = XML.XMLNS_XHTML, // HACK
            localName = HTML.getLocalName(node);

        return PasteCondensed.isInlineContainer(namespaceURI, localName) || PasteCondensed.isBlockPhraseContainer(namespaceURI, localName);
    }
    return false;
};

PasteCondensed.isContentRequiringBlockElement = function (node)
{
    if (node.nodeType === DOM.ELEMENT_NODE)
    {
        var namespaceURI = XML.XMLNS_XHTML, // HACK
            localName = HTML.getLocalName(node);

        return localName === "li" ||
               localName === "dt" ||
               localName === "dd" ||
               localName === "dl" ||
               localName === "ul" ||
               localName === "ol" ||
               localName === "dl";
    }

    return false;
};

PasteCondensed.isBlockPhraseContainer = function (namespaceURI, localName)
{
    return PasteCondensed.isBlockContainer(namespaceURI, localName);
};

/**
 * @param {string} str
 * @return {boolean}
 */
PasteCondensed.isEmptyString = function (str)
{
    // Whitespace, non-breaking space (U+00A0)
    return /^[\s\u00A0]*$/.test(str);
};

/**
 * True for:
 *   hello^
 *   <p>hello^</p>
 *   <i>hello^</i>
 *   <p><i>hello^</i></p>
 *   <p><i>hello^</i>{}</p> (with empty text node as last child of <p>)
 * 
 * Also true for:
 *   Hello^<p>World</p> (mixed content)
 */
PasteCondensed.atEndOfPhrasing = function atEndOfPhrasing(node)
{
    return PasteCondensed.atBoundaryOfPhrasing(node, true);
};

/**
 * @param {string} axis Either "preceding" or "following"
 */
PasteCondensed.atBoundaryOfPhrasing = function atBoundaryOfPhrasing(node, forward)
{
    var atBoundary = true;

    var near = node;

    // true for:
    // - text node that is last child of block level element -- that is: text node that has no following nodes
    // - text node of which the following node has a previous sibling that is a block-level container of the text node
    // - text node that has no parent
    // - text node that has no following node

    while (near && atBoundary)
    {
        near = forward ? XML.getFollowingNode(near) : XML.getPrecedingNode(near);

        if (!near)
            break;

        // Ignore 'invisible' nodes like comments and PIs
        if (near.nodeType === DOM.COMMENT_NODE || near.nodeType === DOM.PROCESSING_INSTRUCTION_NODE)
            continue;

        if (PasteCondensed.isInlineContainerElement(near))
            continue;

        if (DOM.isText(near) && PasteCondensed.isEmptyString(near.nodeValue))
            continue;

        if (PasteCondensed.isBlockPhraseContainer(near.namespaceURI, HTML.getLocalName(near)))
            break;

        atBoundary = false;
    }

    return atBoundary;
};

/**
 * True for:
 *   <p>^hello</p>
 *   <p><i>hello</i></p>
 *
 * Also true for:
 *   <p>Hello</p>^World<p>Bye</p>
 */
PasteCondensed.atStartOfPhrasing = function atStartOfPhrasing(node)
{
    return PasteCondensed.atBoundaryOfPhrasing(node, false);
};

function isEmptyPhrasingNode(near)
{
    if (near.nodeType === DOM.COMMENT_NODE || near.nodeType === DOM.PROCESSING_INSTRUCTION_NODE)
        return true;

    if (PasteCondensed.isInlineContainerElement(near))
        return true;

    if (DOM.isText(near) && PasteCondensed.isEmptyString(near.nodeValue))
        return true;

    return false;
}


function testPrecedingFollowing()
{
    var p = document.createElement("p")
    p.innerHTML = "<i>xyz</i><b>hoi</b>doei";
    var i = p.getElementsByTagName("i")[0];
    var b = p.getElementsByTagName("b")[0];
    var i_text = i.firstChild;
    var b_text = b.firstChild;
    var text = p.lastChild;


    var precedingTest = {
        "p":        XML.getPrecedingNode(p)      === null,
        "i":        XML.getPrecedingNode(i)      === p,
        "i_text":   XML.getPrecedingNode(i_text) === i,
        "b":        XML.getPrecedingNode(b)      === i_text,
        "b_text":   XML.getPrecedingNode(b_text) === b,
        "text":     XML.getPrecedingNode(text)   === b_text
    };

    var followingTest = {
        "p":        XML.getFollowingNode(p)      === i,
        "i":        XML.getFollowingNode(i)      === i_text,
        "i_text":   XML.getFollowingNode(i_text) === b,
        "b":        XML.getFollowingNode(b)      === b_text,
        "b_text":   XML.getFollowingNode(b_text) === text,
        "text":     XML.getFollowingNode(text)   === null
    };

    // debugger
    // XML.getPrecedingNode(text)
    console.dir(precedingTest);
    console.dir(followingTest);
    console.log(XML.getDescendants(p))
};

PasteCondensed.normalizeInlineWhitespace = function normalizeInlineWhitespace(node)
{
    var textNodes = XML.getDescendantsOrSelf(node, DOM.isText);

    List.forEach(textNodes, null, function (node) {

        if (PasteCondensed.isPreformattedCharacterData(node))
            return;

        var value = node.nodeValue;
        var replacement = value;

        // Remove 'evil' non-breaking spaces with
        // (Non breaking spaces are okay between words, not for creating wider spaces)
        replacement = replacement.replace(/\u00A0\u00A0+/g, "\u00A0").replace(/\u00A0+\s+\u00A0*|\s\s+/g, " ");

        if (value !== replacement)
            node.nodeValue = replacement;
    });
};

PasteCondensed.fixInlineWhitespace = function fixInlineWhitespace(node)
{
    var textNodes = XML.getDescendants(node, DOM.isText);

    List.forEach(textNodes, null, function (node) {
        if (PasteCondensed.isEmptyString(node.nodeValue))
        {
            if (DEBUG) console.log("Empty text: ",node, PasteCondensed.isPreformattedCharacterData(node))
            // Prevent removing <pre>\n\n\n\n</pre>
            if (PasteCondensed.isPreformattedCharacterData(node))
                return;

            if (node.length === 0)
            {
                DOM.removeNode(node);
                return;
            }

            // Hello<b> <i>world</i></b>!
            // ->
            // Hello <b><i>world</i></b>!
            if (!node.previousSibling)
            {
                if (DEBUG) console.log("Unwrap text before:",node, node.parentNode, node.parentNode && PasteCondensed.isInlineContainerElement(node.parentNode))

                while (node.parentNode && PasteCondensed.isInlineContainerElement(node.parentNode) && !node.previousSibling)
                {
                    var success = DOM.unwrapBefore(node);
                    if (!success)
                        break;
                }
            }
            // Hello <b><i>world</i> </b>!
            // ->
            // Hello <b><i>world</i></b> !
            else if (!node.nextSibling)
            {
                if (DEBUG) console.log("Unwrap text after:",node, node.parentNode, PasteCondensed.isInlineContainerElement(node.parentNode))

                // Check node.parentNode -- unwrapAfter may remove a Text node and merge it with an adjacent Text node
                while (node.parentNode && PasteCondensed.isInlineContainerElement(node.parentNode) && !node.nextSibling)
                {
                    // DOM.unwrapAfter(node);

                    var success = DOM.unwrapAfter(node);

                    if (DEBUG) console.log("Unwrap text after:",node, node.parentNode, node.parentNode && PasteCondensed.isInlineContainerElement(node.parentNode))
                    if (!success)
                        break;
                }
            }

            // is a whitespace only text node
            // DOM.removeNode(node);
        }
    });
}

PasteCondensed.fixEmptyPhraseContainers = function fixEmptyPhraseContainers(node)
{
    var elements = XML.getElements(node);

    List.forEach(elements, null, function (node) {
    
        if (!XML.hasChildNodes(node))
            if (DEBUG) console.log("Empty node:", node);

        // Remove <b></b> and <li></li>
        if (!XML.hasChildNodes(node) && (PasteCondensed.isInlineContainerElement(node) || PasteCondensed.isContentRequiringBlockElement(node)))
        {
            if (LOG) console.log("Remove empty node: ", node)
            DOM.removeNode(node);
        }
    });
};



/**
 * Convert:
 * <p>Click<a href="#"> here</a></p>
 * to:
 * <p>Click <a href="#">here</a></p>
 * 
 * @param {Node} node
 */
PasteCondensed.splitWhitespace = function splitWhitespace(node)
{
    var textNodes = XML.getDescendantsOrSelf(node, DOM.isText);

    List.forEach(textNodes, null, function (node) {

        if (PasteCondensed.isPreformattedCharacterData(node))
            return;

        var value = node.nodeValue;
        if (DEBUG) console.log("Split off!?", ">"+value+"<")

        // First split of trailing whitespace, after that: split off leading whitespace
        var end = StringPattern.indexOf(value, /[\s\u00A0]+$/);
        var start = StringPattern.indexOf(value, /[^\s\u00A0]/);

        if (PasteCondensed.isInlineContainerElement(node.parentNode))
        {
            if (end > 0)
            {
                node.splitText(end);
                if (LOG) console.log("Split off end")
            }

            if (start > 0)
            {
                node.splitText(start);
                if (LOG) console.log("Split off start")
            }
        }
        else
        {
            if (end > 0 && PasteCondensed.atEndOfPhrasing(node))
                node.deleteData(end, value.length - end);

            if (start > 0 && PasteCondensed.atStartOfPhrasing(node))
                node.deleteData(0, start);
        }
    });
}

PasteCondensed.isEmptyBlock = function isEmptyBlock(node)
{
    var isEmptyBlock = PasteCondensed.isBlockPhraseContainer(XML.XMLNS_XHTML, HTML.getLocalName(node));

    if (isEmptyBlock)
    {
        // TODO: Don't test all descentants, halt at first non-match
        var nonEmpty = XML.getDescendants(node, function (node) { return !isEmptyPhrasingNode(node) });

        isEmptyBlock = nonEmpty.length === 0;
    }

    return isEmptyBlock;
};

/**
 * @param {Node} node
 */
PasteCondensed.fixAdjacentEmptyBlocks = function fixAdjacentEmptyBlocks(node)
{
    var els = XML.getElements(node);

    List.forEach(els, null, function (el) {
        if (PasteCondensed.isEmptyBlock(el))
        {
            var node = el;
            while ((node = node.nextSibling))
            {
                if (node.nodeType === DOM.COMMENT_NODE || node.nodeType === DOM.PROCESSING_INSTRUCTION_NODE)
                    continue;

                if (node.nodeType === DOM.TEXT_NODE && XML.isWhitespace(node.nodeValue))
                    continue;

                if (!PasteCondensed.isEmptyBlock(node))
                    break;

                if (LOG) console.log("Remove adjacent empty block", node);

                var removeThis = node;

                // Move the loop position back one node
                node = node.previousSibling;

                DOM.removeNode(removeThis);
            }
        }
    });
}

/**
 * Remove trailing <br> elements
 * 
 * @param {Node} node
 */
PasteCondensed.fixParagraphSplitters = function fixParagraphSplitters(node)
{
    var elements = XML.getElements(node);

    List.forEach(elements, null, function (node) {
    
        if (PasteCondensed.isParagraphSplitter(XML.XMLNS_XHTML, HTML.getLocalName(node)))
        {
            var atStart = PasteCondensed.atStartOfPhrasing(node),
                atEnd = PasteCondensed.atEndOfPhrasing(node);
            if (DEBUG) console.log("Paragraph splitter", node, atStart, atEnd);

            if (PasteCondensed.atStartOfPhrasing(node) || PasteCondensed.atEndOfPhrasing(node))
            // if (atStart || atEnd)
            {
                if (LOG) console.log("Remove paragraph splitter:",node)
                DOM.removeNode(node);
            }
        }
    });
};

/**
 * @param {Node} node
 */
PasteCondensed.condenseNode = function condenseNode(node)
{
    PasteCondensed.fixParagraphSplitters(node);
    PasteCondensed.normalizeInlineWhitespace(node);

    if (DEBUG) console.log("Fixing misplaced inline whitespace")
    PasteCondensed.splitWhitespace(node);

    if (DEBUG) console.log("Fixing inline whitespace")
    PasteCondensed.fixInlineWhitespace(node);

    if (DEBUG) console.log("Fixing empty phrase containers")
    PasteCondensed.fixEmptyPhraseContainers(node);

    if (DEBUG) console.log("Fixing adjacent empty blocks")
    PasteCondensed.fixAdjacentEmptyBlocks(node);

    if (DEBUG) console.log("Done!")
};


var tests = [
    "  Hello  world  " // "Hello world"
,   "Hello world<br><br>" // "Hello world"
,   "Chapter 6: \u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0Hello world" // "Chapter 6: Hello world"

,   "Joy <i>to</i> the world" // Should not be altered, trimming would be BAD here

,   "<div></div><div></div><div></div>",
,   "Hello<b>   </b>world" // "Hello world"
,   "Hello <del>   </del>world" // "Hello <del>   </del>world"
,   "Click<a> here</a>" // "Click <a>here</a>"
];

function test(html)
{
    console.log("-----");
    console.log(html);
    var dom = DOMPurify.sanitize(html, { RETURN_DOM: true });
    var frag = dom.ownerDocument.createDocumentFragment();
    while (dom.firstChild)
        frag.appendChild(dom.firstChild);
    dom = frag;
    PasteCondensed.condenseNode(dom);
    var html = dom.innerHTML;
    console.log(dom);
    console.log("=====");
}

// test(tests[1]);

})();