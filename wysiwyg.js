var myDoc;

(function($) {
    var pluginFuncs = {};
    var savedRange, isInFocus;
    var piframe;
    var ctrlDown = false,
        vKey = 86,
        cKey = 67;

    $.fn.wysiwyg = function(options) {

        //Check to see if we have any options, if so set them.
        if (typeof options == "object" || typeof options == "undefined") options = setOptions(options);
        //Check to see if any method name was passed via the option arg.
        if (typeof options == "string") if ($.isFunction(pluginFuncs[options])) return pluginFuncs[options](this);

        return this.each(function(e) {
            if (typeof $(this).data("wysiwyg") == "undefined") {
                $.browser.chrome = $.browser.webkit && !! window.chrome;
                $.browser.safari = $.browser.webkit && !window.chrome;
                BuildControl(this, options);
                $(options.holder).css("display", "none"); //hide our textbox;
                $(this).data("wysiwyg", options);
            }
        });

    };

    function HookEvents(iframe) {
        //iframe.keydown(testing);
        iframe.keydown(IframeKeyDown);
        iframe.keyup(IframeKeyUp);
        iframe.keyup(styleCheckKeyUp);
        iframe.click(styleCheckClick);
        iframe.mouseup(styleCheckClick);
    }

    function testing(e) {
        if (e.ctrlKey && e.keyCode == 86) {
            console.log("paste");
            $("#tempholder").focus();
        }
    }

    function IframeKeyDown(e) {
        var view = this;
        //Check for ctrl key
        if (e.keyCode == 17) ctrlDown = true;

        CatchPaste(e, view);
    }

    function IframeKeyUp(e) {
        //check for control key
        if (e.keyCode == 17) ctrlDown = false;

        if ($.browser.mozilla || $.browser.safari || $.browser.chrome) {

            var win = this.defaultView;
            var doc = this;
            myDoc = this;

            var anchorNodeName = win.getSelection().anchorNode.nodeName;
            //TODO: use the current default 'block' style that is selected.
            if (e.keyCode == 13 && !e.shiftKey) {
                //Remove <br>
                $(doc.body).children("br").remove();

                //Create a paragraph block
                console.log(doc.execCommand("formatblock", false, "p"));

                return false;
            }

            if (anchorNodeName == "BODY" || anchorNodeName == "DIV") doc.execCommand("formatblock", false, "p");
        }
    }

    function CatchPaste(e, view) {
        if (ctrlDown && (e.keyCode == vKey)) {
            var doc = view,
                win = view.defaultView;
            saveSelection2(doc, win);
            var tempText = $("<textarea id=tempholder class=farleft />").appendTo(piframe.contents().find("body")).focus();
            setTimeout(function() {
                piframe.focus();
                restoreSelection2(win);
                var output = "";
                if (tempText.val().indexOf("\n") > -1) $.each(tempText.val().split(/[\n\r]+/g), function(i, el) {
                    if (el) {
                        output += '<p>' + el + '</p>';
                    }
                });
                else output = tempText.val();

                if (doc.selection) doc.selection.createRange().pasteHTML(output);
                else doc.execCommand("insertHTML", false, output);
                tempText.remove();
            }, 0);
        }
    }

    function FindNodePath() {}

    function setOptions(options) {
        return $.extend($.fn.wysiwyg.defaults, options);
    }

    function BuildControl(control, options) {
        //Insert stylesheet
        //var stylesheet = '<link href="' + options.stylesheet + '" rel="stylesheet" type="text/css" />'
        //$(control).parents("HTML").children("HEAD").append(stylesheet);
        //Add our wysiwyg class to the main container
        $(control).addClass("wysiwyg");

        var $toolbar = $('<div class="wysiwyg-Tools"><ul></ul></div>');

        //Build our toolbar items
        $(options.tools).each(function(i, e) {
            var item = '<li class="' + e + '"><a href="#' + e + '"> </a></li>';
            $(item).appendTo($toolbar.children("ul"));
        });

        $toolbar.appendTo($(control));

        //Build our iframe
        var $editer = $('<div class="wysiwyg-Editor"></div>');

        var $iframe = $('<iframe id=myIframe onload=$("#' + $(control).attr("id") + '").wysiwyg("frameReady") src=' + options.iframeHTML + ' frameborder="0" allowTransparency="true"></iframe>');

        $iframe.appendTo($editer);

        $editer.appendTo($(control));

        //Set designMode on for IE. Doesn't work for any other browser until the load event is triggered.
        if ($.browser.msie && $.browser.version == "7.0") $iframe.contents()[0].designMode = "on";

        //Hookup our toolbar buttons
        hookupTools($toolbar.children("ul"), $iframe);

        piframe = $iframe;
    }

    function hookupTools(tools, iframe) {
        $(tools).find("li > a").click(function(e) {
            //var option = $(this).attr("hash").replace("#", "");
            var option = $(this).attr("href").replace("#", "");
            iframe[0].contentWindow.focus();
            execCommand(option, iframe.contents()[0], false);
            $(this).toggleClass("on");
            return false;
        });
    }

    function execCommand(command, doc, contents) {
        try {
            doc.execCommand(command, false, contents);
        }
        catch (e) {
            return false;
        }
    }

    function RemoveStyles(iframe, ie) {
        if (ie) {
            $("iframe")[0].contentWindow.document.execCommand("styleWithCSS", false, false);
            return;
        }
        iframe[0].execCommand("styleWithCSS", false, false);
    }

    function styleCheckClick(e) {
        CheckAppliedStyles(this);
    }

    function styleCheckKeyUp(e) {
        var k = e.keyCode;
        if (k == 37 || k == 38 || k == 39 || k == 40) CheckAppliedStyles(this);
    }

    function CheckAppliedStyles(doc) {
        //Grab the document if gecko browsers or the range if msie (poo)
        var range = $.browser.mozilla || $.browser.safari || $.browser.opera || $.browser.chrome ? doc : doc.selection.createRange();
        //Get the control that the iframe belongs to.
        var control = GetWysiwyg(doc);
        var options = control.data("wysiwyg");

        //Clear all selected toolbar items
        control.find(".wysiwyg-Tools > ul > li > a").removeClass("on");

        //Loop through each tool, check to see if its a valid command and turn on if the element has the command applied.
        var tools = options.tools;
        for (var i in tools) {
            if (queryCommandIndeterm(range, tools[i]) || queryCommandState(range, tools[i])) control.find("." + tools[i] + " > a").addClass("on");
        }
    }

    function GetWysiwyg(control) {
        return $.browser.mozilla || $.browser.safari || $.browser.opera || $.browser.chrome ? $(control.defaultView.frameElement).parents(".wysiwyg") : $(control.parentWindow.frameElement).parents(".wysiwyg");
    }

    function queryCommandState(control, item) {
        try {
            return control.queryCommandState(item);
        }
        catch (e) {
            return false;
        }
    }

    function queryCommandIndeterm(control, item) {
        try {
            return control.queryCommandIndeterm(item);
        }
        catch (e) {
            return false;
        }
    }


    function saveSelection2(ie, normal) {
        if ($.browser.msie) savedRange = ie.selection.createRange();
        else savedRange = normal.getSelection().getRangeAt(0);
    }

    function restoreSelection2(normal) {
        isInFocus = true;
        if (savedRange != null) {
            if ($.browser.msie) savedRange.select();
            else if (normal.createRange) normal.getSelection().addRange(savedRange);
            else if (normal.getSelection) {
                var s = normal.getSelection();
                if (s.rangeCount > 0) s.removeAllRanges();
                s.addRange(savedRange);
            }
        }
    }

    function saveSelection(doc, win) {
        if (win.getSelection) //non IE Browsers
        {
            savedRange = win.getSelection().getRangeAt(0);
        }
        else if (doc.selection) //IE
        {
            savedRange = doc.selection.createRange();
        }
    }

    function restoreSelection(doc, win) {
        isInFocus = true;
        if (savedRange != null) {
            if (win.getSelection) //non IE and there is already a selection
            {
                var s = win.getSelection();
                if (s.rangeCount > 0) s.removeAllRanges();
                s.addRange(savedRange);
            }
            else if (win.createRange) //non IE and no selection
            {
                win.getSelection().addRange(savedRange);
            }
            else if (doc.selection) //IE
            {
                savedRange.select();
            }
        }
    }


    $.fn.wysiwyg.defaults = {
        iframeHTML: "iframe.html",
        tools: ["format", "bold", "italic", "underline"],
        stylesheet: "wysiwyg.css",
        holder: ".wysiwygHolder"
    };
    $.extend(pluginFuncs, {
        frameReady: function(control) {
            return control.each(function(e) {
                var iframe = $(this).find("iframe").contents();
                if ($.browser.mozilla) {
                    iframe.find("[_moz_editor_bogus_node=TRUE]").remove();
                }
                if (!$.browser.msie) {

                    iframe.find("body").css("margin-right", "16px");

                    // Testing area
                    RemoveStyles(iframe, false);
                }


                var options = control.data("wysiwyg");
                options.iframe = this;

                //Hide our textbox and load its content if it exists.
                var $holder = $(options.holder);
                $holder.css("display", "none");
                if ($holder.val().length > 0) iframe.find("body").html($holder.val());

                $holder.change(function() {
                    iframe.find("body").html($holder.val());
                });

                HookEvents(iframe);
            });
        },
        getEncHTML: function(control) {
            var html = "";
            control.each(function(e) {
                html = $(this).find("iframe").contents().find("body").html().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            });

            return html;
        },
        getHTML: function(control) {
            var html = "";
            control.each(function(e) {
                html = $(this).find("iframe").contents().find("body").html();
            });
            return html;
        }
    });

    $.fn.encHTML = function() {
        return this.each(function() {
            var me = $(this);
            var html = me.html();
            me.html(html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
        });
    };
})(jQuery);