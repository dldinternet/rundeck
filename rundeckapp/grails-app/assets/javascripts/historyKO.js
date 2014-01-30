//= require momentutil
//= require knockout.min
//= require knockout-foreachprop
//= require knockout-mapping

/*
 Copyright 2013 SimplifyOps Inc, <http://simplifyops.com>

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */


function Report(data) {
    var self = this;
    self.dateCompleted = ko.observable();
    self.dateStarted = ko.observable();
    self.execution = ko.observable();
    self.executionHref = ko.observable();
    self.jobId = ko.observable();
    self.executionId = ko.observable();
    self.reportId = ko.observable();
    self.title = ko.observable();
    self.jobAverageDuration = ko.observable(0);
    self.duration = ko.observable(0);

    self.durationSimple = ko.computed(function () {
        return MomentUtil.formatDurationSimple(self.duration());
    });
    self.durationHumanize = ko.computed(function () {
        return MomentUtil.formatDurationHumanize(self.duration());
    });
    self.startTimeFormat = function (format) {
        return MomentUtil.formatTime(self.dateStarted(), format);
    };
    self.endTimeSimple = ko.computed(function () {
        return MomentUtil.formatTimeSimple(self.dateCompleted());
    });

    self.jobPercentage = ko.computed(function () {
        if (self.jobAverageDuration() > 0) {
            return 100 * (self.duration() / self.jobAverageDuration());
        } else {
            return -1;
        }
    });
    self.jobPercentageFixed = ko.computed(function () {
        var pct = self.jobPercentage();
        if (pct >= 0) {
            return pct.toFixed(0)
        } else {
            return '0';
        }
    });
    self.jobOverrunDuration = ko.computed(function () {
        var jobAverageDuration = self.jobAverageDuration();
        var execDuration = self.duration();
        if (jobAverageDuration > 0 && execDuration > jobAverageDuration) {
            return MomentUtil.formatDurationSimple(execDuration - jobAverageDuration);
        } else {
            return '';
        }
    });
    self.endTimeFormat = function (format) {
        var value = self.dateCompleted();
        return MomentUtil.formatTime(value, format);
    };
    self.nodeFailCount = ko.computed(function () {
        var ncount = ko.utils.unwrapObservable(self.node);
        if(ncount){
            var ns = ncount.split('/');
            if (ns.length == 3) {
                return parseInt(ns[1]);
            }
        }
    });

    self.nodeSucceedCount = ko.computed(function () {
        var ncount = ko.utils.unwrapObservable(self.node);
        if(ncount){

        var ns = ncount.split('/');
        if (ns.length == 3) {
            return parseInt(ns[0]);
        }
        }
    });
    ko.mapping.fromJS(data, {}, self);
}
function History(ajaxHistoryLink,ajaxNowRunningLink) {
    var self = this;
    self.ajaxHistoryLink = ajaxHistoryLink;
    self.ajaxNowRunningLink = ajaxNowRunningLink;
    self.reports = ko.observableArray([]);
    self.nowrunning = ko.observableArray([]);
    self.showReports=ko.observable(false);
    self.nowRunningEnabled=ko.observable(true);
    self.href = ko.observable();
    self.selected = ko.observable(false);
    self.max = ko.observable(20);
    self.total = ko.observable(0);
    self.offset = ko.observable(0);
    self.params = ko.observable();
    self.reloadInterval=ko.observable(0);
    self.highlightExecutionId=ko.observable();
    self.results=ko.computed(function(){
       if(self.showReports()){
           return self.reports()
       } else{
           return self.nowrunning()
       }
    });
    self.count = ko.computed(function () {
        return self.reports().length + self.offset() * self.max();
    });
    self.pageCount=ko.computed(function(){
        return totalPageCount(self.max(),self.total());
    });
    self.pages=ko.computed(function(){
        var total = self.total();
        var offset = self.offset();
        var max = self.max();
        var href = self.href();
        if (total < 1 || !href) {
            return '';
        }
        var pages = [];
        //remove offset/max params from href
        href=href.replace(/[&\?](offset|max)=\d+/ig,'');

        foreachPage(offset, max, total, {maxSteps:10}, function (pg) {
            var a;
            var url = _genUrl(href, {offset: pg.offset, max: pg.max});
            var label = pg.prevPage ? 'Previous' : pg.nextPage ? 'Next' : pg.skipped? '…' : (pg.page);
            pages.push(ko.utils.extend({url:url,label:label},pg));
        });

        return pages;
    });
    self.visitPage=function(page){
        loadHistoryLink(self,self.ajaxHistoryLink,page.url);
    };
    self.activateNowRunningTab=function() {
        jQuery('ul.activity_links > li:first-child').addClass('active');
        jQuery('ul.activity_links > li:first-child > a').each(function (e) {
            loadHistoryLink(self, self.ajaxNowRunningLink, this.getAttribute('href'), jQuery(this).data('auto-refresh'));
        });
    };
}

var binding = {
    'reports': {
        key: function (data) {
            return ko.utils.unwrapObservable(data.id);
        },
        create: function (options) {
            return new Report(options.data);
        }
    },
    'nowrunning': {
        key: function (data) {
            return ko.utils.unwrapObservable(data.id);
        },
        create: function (options) {
            return new Report(jQuery.extend({execution: options.data},options.data));
        }
    }
};
function loadHistoryLink(history, ajaxBaseUrl, href,reload) {
    var params = href.substring(href.indexOf('?')+1);
    var url = ajaxBaseUrl.indexOf("?")>0? ajaxBaseUrl+'&' + params : ajaxBaseUrl+'?' + params;

    var handleResult;
    var load=function(){
        history.href(href);
        jQuery.getJSON(url, handleResult);
    }
    handleResult= function (data) {
        history.selected(true);
        ko.mapping.fromJS(Object.extend(data, { params: params }), binding, history);
        setTimeout(function(){
            if (reload && history.href() == href) {
                load();
            }
        }, reload * 1000);
    };
    load();
}

function setupActivityLinks(id, history) {
    jQuery('#' + id + ' a.activity_link').click(function (e) {
        e.preventDefault();
        var me = jQuery(this)[0];
        jQuery('#' + id + ' .activity_links > li').removeClass('active');
        jQuery(me.parentNode).addClass('active');
        history.showReports(true);
        loadHistoryLink(history, history.ajaxHistoryLink, me.getAttribute('href'),jQuery(this).data('auto-refresh'));
    });
    jQuery('#' + id + ' a.running_link').click(function (e) {
        e.preventDefault();
        var me = jQuery(this)[0];
        if(history.nowRunningEnabled()){
            jQuery('#' + id + ' .activity_links > li').removeClass('active');
            jQuery(me.parentNode).addClass('active');
            history.showReports(false);

            loadHistoryLink(history, history.ajaxNowRunningLink, me.getAttribute('href'), jQuery(this).data('auto-refresh'));
        }
    });
}
