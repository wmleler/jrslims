// Jack Rabbit Slims chat room
/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true,
  strict:true, undef:true, unused:true, curly:true, indent:2 */
/*global jQuery:false, Firebase:false, window:false, document:false,
  console:false, prompt:false, setTimeout:false */

(function($) {
  "use strict";

  var DATABASE = 'https://jrslims.firebaseIO.com/';
  var KEEPNUM = 250;  // minimum number of posts to keep
  var KEEPTIME = 86400000;  // keep posts for at least one day

  // profile data
  var id = ''; // userid
  var work = false; // work mode
  var email = '';  // email address
  var avatar = ''; // user icon
  var modifierkey = 16, enterkey = 13;  // submit: shift return
	var fontsize = 16;	// font size in px

  // global variables
  var me; // user object
  var lastseen = null; // last post I've marked as read
  var unseen = 0; // number of messages that have not been marked read
  var online = true;  // am I connected to Firebase?
  var messageBodies = {};  // message bodies, keyed by Firebase name
  var files = []; // uploaded files for a message
  var modifierdown = false;  // is shift key down?
  var shame = []; // hall of shame users
  var timeout;  // time last message arrived
  var messageInputHeight; // default height of messageInput textarea
  var paramOverride = false;
  var client = ''; // user's domain or IP address
  var lastAnimation = null; // last message animating open
  var lastpost = null;  // save last message for editing
  var imgWidth, imgHeight;  // max size of images

	function getParams(p) { // read from URL parameters or cookie
		var params = {}; // parameters
		p.replace(/[?&;]\s?([^=&;]+)=([^&;]*)/gi,
		function(m,key,value) { params[key] = value; });

		if (params.id) { id = params.id; }
		if (params.modifierkey) { modifierkey = +params.modifierkey; }
		if (params.enterkey) { enterkey = +params.enterkey; }
		if (params.work) { work = params.work === 'true'; }
		if (params.fontsize) { fontsize = +params.fontsize; }
		if (params.email) { email = params.email; }
		if (params.avatar) { avatar = params.avatar; }
	}

  getParams('?'+document.cookie);  // get work from cookie

  // get ID from URL
  if (window.location.search.search(/^\?[\w% ]{1,}$/) === 0) {
    id = $.trim(decodeURIComponent(window.location.search.slice(1)));
  } else if (window.location.hash.search(/^#[\w% ]{1,}$/) === 0) {
    id = $.trim(decodeURIComponent(window.location.hash.slice(1)));
  } else {
    getParams(window.location.href); // params from URL
    paramOverride = true;
  }

  $(document).ready(function() {

    var $win = $(window);

    // when leaving, check for orphaned message
    window.onbeforeunload = function(e) {
      if(!e) { e = window.event; }  // IE
      if ($.trim($('#messageInput').val()).length > 0) {
        e.returnValue = 'You have entered a message in Slims!'
        return e.returnValue;
      }
    }

    function resize() { // automatic resizing of images to fit window
      imgWidth = $win.innerWidth() - 42;
      imgHeight = $win.innerHeight() - 20;
      $('#messagesDiv div.userimg img').css({
        maxWidth: imgWidth + 'px',
        maxHeight: imgHeight + 'px'
      });
    }

    $win.on('resize', resize);
    resize();

    $('#logo').toggleClass('show', !work);
    $('body').css('font-size', fontsize);

    // determine user id
		var t;
    while (id.search(/^[\w ]{1,}$/) !== 0) {
      t = $.trim(prompt('Enter your ID (containing A-Z a-z 0-9 _ space):', id));
      if (t.length === 0) {
        window.location.href = 'http://jrslims.com';
        return;
      }
      id = t;
    }

    $('#user').text(id);  // profile button label

    // firebase references
    var firebasedb = new Firebase(DATABASE);
    var connectdb = firebasedb.child('.info/connected'); // connected
    var msgdb = firebasedb.child('messages'); // list of messages
    var onoffdb = firebasedb.child('onoff');
    var myonoffdb;  // when I go on or off line
    var mystatusdb; // myonoffdb/status
    var usersdb = firebasedb.child('users');  // all user profiles
    var myuserdb = usersdb.child(id);  // my profile

    myuserdb.once('value', startup);  // firebase startup

    // get user profile and start messages
    function startup(snap) {
      me = snap.val();  // user profile
      if (me === null) {  // new user
        var t = $.trim(prompt('ID "'+id+'" doesn\'t exist. Retype to create it or switch to different name.'));
        if (t.length === 0) {
          window.location.href = 'http://jrslims.com';
          return;
        }
        if (t !== id) {
          id = t;
          $('#user').text(id);
          myuserdb = usersdb.child(id);  // my profile
          myuserdb.once('value', startup);
          return;
        }
        me = {  // default values for new user
          lastseen: null,
          avatar: 'avatars/newuser.png',
          modifierkey: modifierkey,  // shift key
          enterkey: enterkey  // return key
        };
        myuserdb.set(me); // inititalize
        $('#user, #logo').click();
      }
      if (me.lastseen !== undefined) { lastseen = me.lastseen; }
      if (me.email !== undefined) { email = me.email; }
      if (me.avatar !== undefined) { avatar = me.avatar; }
      if (me.modifierkey !== undefined) { modifierkey = +me.modifierkey; }
      if (me.enterkey !== undefined) { enterkey = +me.enterkey; }

      if (paramOverride) { getParams(window.location.href); }

      myonoffdb = onoffdb.child(id);
      mystatusdb = myonoffdb.child('status');

      connectdb.on('value', presencechange);

      var now = new Date();
      $('#usertime').html('<time>'+now.toLocaleTimeString()+'</time>').attr('title', now.toLocaleDateString()).click(uptime);

      timeout = now.valueOf();
      setTimeout( function() {  // delay until after logo appears
        msgdb.on('child_added', addmessages); // start getting messages
        msgdb.on('child_removed', dropmessages);  // remove from messages list
      }, 10);
    } // end startup (get user profile)

    // add messages to page
    function addmessages(snap) {
      var message = snap.val();
      var mstamp = message.stamp;
      var now = (new Date()).valueOf();
      if (now - timeout > 5000) { // 5 seconds
        uptime();
        timeout = now;
      }
      var newdiv = $('<div/>', { id: snap.key(), 'class': 'msgdiv' });
      if (message.avatar) {
        $('<img/>', { 'class': 'avatar'+(work ? '' : ' show'), src: message.avatar }).appendTo(newdiv);
      }
      newdiv.append('<strong>'+(message.email ?
          '<a href="mailto:'+message.email+'">'+message.name+'</a>' :
          message.name)+'</strong>').
        append(message.host ? ' ('+message.host+')' : '').
        append($('<div/>', {'class': 'msgtime'}).data('mts', mstamp).
        html('<time>'+deltaTime(now - mstamp)+' ago</time>')).
        append($('<div/>', { 'class': 'msgbody' }).html(message.text));
      newdiv.find('.msgbody iframe').wrap('<div class="uservid" />');
      newdiv.find('div.uservid > div.uservid').unwrap();  // get rid of multiple vid wraps
      // newdiv.find('.msgbody img:not([src^="e/"])').wrap('<div class="userimg" />');
      newdiv.find('.msgbody img').filter(function() {
        var src = this.getAttribute('src');
        return src.match(/^(e|emoticons)\//) === null;
      }).css({
        maxWidth: imgWidth + 'px',
        maxHeight: imgHeight + 'px'
      }).wrap('<div class="userimg" />');
      newdiv.find('div.userimg > div.userimg').unwrap();  // get rid of multiple img wraps
      newdiv.find('div.userimg, div.uservid').toggleClass('worksmall', work).click(imagebig);
      newdiv.find('blink').toggleClass('hideme', work);
      $('#messagesDiv').prepend(newdiv);
      // if (mstamp <= lastseen) {
      if (snap.key() <= lastseen) {
        newdiv.addClass('read');
      } else {  // unread message, animate
        unseen++; settitle();
        if (lastAnimation !== null) {
          lastAnimation.finish(); // finish animation before starting another one
        }
        newdiv.hide().slideDown(500, function() {
          lastAnimation = null;
        });  // slow reveal
        lastAnimation = newdiv;
      }
      messageBodies[snap.key()] = newdiv.html();  // keep track of messages
    } // end add messages

    function dropmessages(snap) { // sync from Firebase
      var name = snap.key();
      var msgbody = messageBodies[name];
      if (msgbody !== undefined) {
        delete messageBodies[name];
      }
      $('#'+name).remove();  // remove message from DOM
    } // end dropmessages

    function presencechange(snap) { // manage whether I am connected or not, and timestamp when I disconnect
      if (snap.val() === true) {  // online
        var status = {
          time: Firebase.ServerValue.TIMESTAMP,
          client: client,
          agent: navigator.userAgent
        };
        var stat = mystatusdb.push(status); // status of this connection
        stat.onDisconnect().remove(); // remove on disconnect
        myonoffdb.onDisconnect().update({ offline: Firebase.ServerValue.TIMESTAMP });  // disconnect time
        myonoffdb.update({ online: Firebase.ServerValue.TIMESTAMP }); // I am online now

        online = true;
        $('#kibbitz').css('opacity', 1.0);
        $('#usertime').text('').css('color','black');
        uptime();
      } else {  // offline
        online = false;
        $('#kibbitz').css('opacity', 0.3);  // dim kibbitz button
        $('#usertime').text('Offline').css('color','red');
      }
    } // end presencechange

    // grow textarea automatically and handle keyboard Submit
    messageInputHeight = $('#messageInput').on('keyup keydown', function(e) {
      if (e.which === modifierkey) { // default SHIFT
        modifierdown = (e.type === 'keydown');
        return;
      }
      if (e.which === enterkey) { // default RETURN
        if (modifierdown || modifierkey === -1) {
          e.preventDefault();
          if (e.type === 'keyup') {
            $('#kibbitz').click();
          }
          return false;
        }
      }
      modifierdown = false;
      adjustHeight(e.delegateTarget);
    }).on('paste', function(e) {
      adjustHeight(e.delegateTarget);
    }).css('height');

    function adjustHeight(el) { // adjust height of input text area
      if (el.scrollHeight > el.clientHeight) {
        el.style.height = (4 + el.scrollHeight)+'px';
      }
    }

    function imagebig(e) {  // in work mode, toggle image size
      var $t = $(e.target);
      if (e.shiftKey) {
        window.open($t.find(e.target.classList.
            contains('uservid') ? 'iframe' : 'img').attr('src'));
        return;
      }
      $t.toggleClass('worksmall');
      return false;
    }

    function complete(v) {
      if (v === null) { // success
        $('#delmsg').css('display', 'inline-block');
        $('#messageInput').val('').css('height', messageInputHeight); // clear message text
        files = [];
        $('.qq-upload-list').empty(); // clear list of uploaded files
        $('.qq-upload-drop-area').hide(); // hide drop area
      }
    }

    // post new message and delete old messages
    $('#kibbitz').click( function() {
      if (!online) { return; }  // do nothing if not online (should save message!)
      var name = $('#user').text();
      var mess = $.trim($('#messageInput').val());
      var deleted = 2;  // number of messages to delete
      if (mess.length > 0 || files.length > 0) {  // message or files
        if (mess.length === 0) {  // files uploaded, but no message
          mess = 'Attachments:';
          $.each(files, function(i, v) {
            mess += ' <a href="'+v+'" target="_blank">'+v+'</a>';
          });
        } else {  // linkify message
          mess = mess.replace(urlRegex, '<a href="$&" target="_blank">$&</a>'). // URL to link
              replace(mailRegex, '<a href="mailto:$&">$&</a>'); // mail address to link
        }
        var post = {
          name: name,
          text: mess,
          stamp: Firebase.ServerValue.TIMESTAMP
        };
        if (email) { post.email = email; }
        if (client) { post.host = client; }
        if (avatar) { post.avatar = avatar; }
        if (files.length > 0) { post.files = files.join("\n"); }
        lastpost = msgdb.push(post, complete);  // post
        lastpost.setPriority(Firebase.ServerValue.TIMESTAMP);
        // lastpost.setWithPriority(post, Firebase.ServerValue.TIMESTAMP);
        // $('#delmsg').css('display', 'inline-block');
        // $('#messageInput').val('').css('height', messageInputHeight); // clear message text
        // files = [];
        // $('.qq-upload-list').empty(); // clear list of uploaded files
        // $('.qq-upload-drop-area').hide(); // hide drop area
      }

      uptime(); // update times

      if (console && console.log) { console.log('number of messages:', Object.keys(messageBodies).length); }
      deletemsg(null);  // delete expired messages and files
      // if (Object.keys(messageBodies).length > KEEPNUM) {  // might need to delete an old message
        // dnum = Math.min(3, messageBodies.length - KEEPNUM);
        // var olddb = msgdb.endAt(tsp);
        // msgdb.once('child_added', cleanupmsg);
      // }

      function deletemsg(error) {
        if (error !== null) {
          if (console && console.log) { console.log('Error deleting message:', error); }
          return;
        }
        if (deleted-- > 0 && Object.keys(messageBodies).length > KEEPNUM) {
          msgdb.once('child_added', cleanupmsg);
        }
      }

      function cleanupmsg(snap /*, second */) { // delete old message and files
        var m = snap.val();
        if (m.stamp < (new Date()) - KEEPTIME) {  // should use priority
          if (m.files && m.files.length > 0) { // delete uploaded files
            $.each(m.files.split("\n"), function(i, v) {
              $.get('delete.php?file='+v);
            });
          }
          snap.ref().remove(deletemsg);  // delete message from Firebase
        }
      }

    }); // end click on kibbitz button (post new message)

    // delete / edit message (scissors)
    $('#delmsg').click( function() {
      if (lastpost === null) { return; }
      var $msg = $('#'+lastpost.key());  // get DOM for last post
      if (!$msg.hasClass('read')) { unseen--; settitle(); }
      adjustHeight(($('#messageInput').val($msg.find('.msgbody').html()))[0]);
      $('#delmsg').css('display', 'none');
      lastpost.remove();
      lastpost = null;
    });

    // formatting buttons
    $('#formatbuttons').on('click', 'span.button', function(e) {
      var el = e.target;
      switch(el.title) {
        case 'File Upload': break;
        case 'Link':        alink(); break;
        case 'Image':       img(); break;
      }
    });

    $('#styles').on('click', 'span.button', function(e) {
      var el = e.target;
      switch(el.title) {
        case 'Bold':        wrap('<b>','</b>'); break;
        case 'Italic':      wrap('<i>','</i>'); break;
        case 'Underline':   wrap('<u>', '</u>'); break;
        case 'Strike' :     wrap('<s>', '</s>'); break;
        case 'Monospace':   wrap('<font face="monospace">', '</font>'); break;
        case 'Color':       wrap('<font color="red">', '</font>'); break;
        case 'Size':        wrap('<font size="+2">', '</font>'); break;
        case 'Blink':       wrap('<blink>', '</blink>'); break;
        case 'Spacing':     wrap('<pre>', '</pre>'); break;
        case 'Indent':      wrap('<ins>', '</ins>'); break;
        case 'Block Quote': wrap('<blockquote>', '</blockquote>'); break;
      }
    });

    // click to mark post as read
    $('#messagesDiv').on('click', '.msgdiv', function() {
      if (!isNaN(lastseen) || this.id > lastseen) {
        lastseen = this.id;
        myuserdb.update({'lastseen': lastseen}); // save id of last seen
      }

      // var $this = $(this);
      // var mts = $this.find('.msgtime').data('mts');
      // if (mts > lastseen) {
      //   lastseen = mts;
      //   myuserdb.update({'lastseen': lastseen}); // save time of last seen
      // }
      uptime();
    });

    // receive message read from database and mark messages
    myuserdb.child('lastseen').on('value', function(snap) {
      unseen = 0;
      var lsid = snap.val();
      $('.msgdiv:not(.read)').filter(function(/* i, el */) {
        if (this.id > lsid) { unseen++; }
        return this.id <= lsid;
      }).addClass('read');

      settitle(); // show number of unread messages
    });

    // drag and drop file uploader
    $('#fine-uploader').fineUploader({
      // debug: true,  // turn off for production
      request: { endpoint: 'endpoint.php' },
      retry: { enableAuto: true },
      button: document.getElementById('fileup'),
      ios: true,
      scaling: {
        sendOriginal: false,
        sizes: [
          { name: '', maxSize: 1600 }
        ]
      }
    }).on('complete', function(event, id, fileName, responseJSON) {
      if (responseJSON.success) {
        var uploadName = responseJSON.uuid + '/' + responseJSON.uploadName;
        files.push(uploadName);
        var suffix = fileName.slice(1+fileName.lastIndexOf('.')).toLowerCase();
        if (suffix==='jpg' || suffix==='jpeg' || suffix==='png' || suffix==='gif') {
          insert('<img src="files/'+uploadName+'" />');
        } else if (suffix==='mp3') {
          insert('<audio controls><source src="files/'+uploadName+'" type="audio/mpeg">'+
            '<a href="files/'+uploadName+'" target="_blank">'+fileName+'</a></audio>');
        } else {
          insert('<a href="files/'+uploadName+'" target="_blank">'+fileName+'</a>');
        }
      }
    });

    // emoticon menu
    function emo(e) {
      insert('<img src="'+$(e.target).attr('src')+'" />');
      $(document).off('click', cancelemo);
      $('#emoticons img').off('click', emo);
      $('#emoticons').hide();
      $('#formatbuttons').show();
      return false;
    }

    function cancelemo() {
      $(document).off('click', cancelemo);
      $('#emoticons img').off('click', emo);
      $('#emoticons').hide();
      $('#formatbuttons').show();
    }

    $('#emobutton').on('click', function() {
      $('#formatbuttons').hide();
      $('#emoticons').show();
      $('#emoticons img').on('click', emo);
      $(document).on('click', cancelemo);
      return false;
    });

    // special characters menu
    function spc(e) {
      var c = $(e.target).html();
      var pos = c.search(/[FC]$/);
      if (pos === -1) { // not temperature
        insert(c);
      } else {
        temperature(c.charAt(pos));
      }
      $(document).off('click', cancelspc);
      $('#specialchars span').off('click', spc);
      $('#specialchars').hide();
      $('#formatbuttons').show();
      return false;
    }

    function cancelspc() {
      $('#specialchars span').off('click', spc);
      $(document).off('click', cancelspc);
      $('#specialchars').hide();
      $('#formatbuttons').show();
    }

    $('#spcbutton').on('click', function() {
      $('#formatbuttons').hide();
      $('#specialchars').show();
      $('#specialchars span').on('click', spc);
      $(document).on('click', cancelspc);
      return false;
    });

    // style buttons menu
    function sty(e) {
      $(document).off('click', cancelsty);
      $('#styles span').off('click', spc);
      $('#styles').hide();
      $('#formatbuttons').show();
    }

    function cancelsty() {
      $('#styles span').off('click', sty);
      $(document).off('click', cancelsty);
      $('#styles').hide();
      $('#formatbuttons').show();
    }

    $('#stylebutton').on('click', function() {
      $('#formatbuttons').hide();
      $('#styles').show();
      $('#styles span').on('click', sty);
      $(document).on('click', cancelsty);
      return false;
    });

    // Profile
    $('#user').click(function() {
      if ($('#profile:visible').length) { cancelprofile(); return false; }
      var table = '<img class="close" src="img/close_icon.gif" />'+
          '<table><tr><td></td></tr><tr><td id="Ptext" colspan="2">rofile for&nbsp;'+id+
          '</td></tr><tr><td colspan="2" style="font-weight:normal">&nbsp;('+client+
          ')</td></tr><tr><td style="text-align:right">work:</td><td><input id="work" type="checkbox" '+(work ? 'checked="checked" ' : '')+
          ' /> (only on this device)</td></tr><tr><td style="text-align:right">fontsize:</td><td><input id="fontsize" type="range" value="'+
          fontsize+'" min="12" max="20" step="0.5" /><span id="dispfs">'+fontsize+
          '</span>px</td></tr><tr><td style="text-align:right">submit:</td><td><select id="modifierkey" value="'+
          modifierkey+'"><option value="16">shift</option><option value="17">ctrl</option><option value="27">esc</option>'+
          '<option value="-1">(none)</option></select> <select id="enterkey" value="'+
          enterkey+'"><option value="13">return</option><option value="38">&uarr;</option><option value="39">&rarr;</option>'+
          '<option value="40">&darr;</option><option value="35">end</option><option value="-1">(none)</option></select></td></tr>'+
          '<tr><td style="text-align:right">email:</td><td><input id="email" type="text" value="'+
          email+'" /></td></tr><tr><td style="text-align:right">avatar:</td><td><img id="myavatar" src="'+
          avatar+'" width="39" height="50" /> <input id="avatarurl" type="text" value="'+
          avatar+'" /></td></tr></table><div id="cloakroom"></div>';
      $('#profile').show().on('click', 'img.close', cancelprofile).html(table);
      $('#work').change(function() {
        work = $(this).prop('checked');
        $('#logo, div.msgdiv img.avatar').toggleClass('show', !work);
        $('div.userimg, div.uservid').toggleClass('worksmall', work);
        $('blink').toggleClass('hideme', work);
        setCookie('work', work ? 'true' : 'false');
      });
			$('#fontsize').change(function() {
        fontsize = +$.trim($(this).val());
        $('body').css('font-size', fontsize);
        $('#dispfs').text(fontsize);
        setCookie('fontsize', fontsize);
      }).mousemove(function() {
        $('#dispfs').text($.trim($(this).val()));
      });
      $('#email').change(function() {
        email = $.trim($(this).val());
        setTimeout(function() { myuserdb.update({ email: email }); }, 10);
      });
      $('#modifierkey').val(modifierkey).change(function() {
        modifierkey = +$.trim($(this).val());
        setTimeout(function() { myuserdb.update({ modifierkey: modifierkey }); }, 10);
      });
      $('#enterkey').val(enterkey).change(function() {
        enterkey = +$.trim($(this).val());
        setTimeout(function() { myuserdb.update({ enterkey: enterkey }); }, 10);
      });
      $('#myavatar').parent().on('click', function() {
        if ($('#cloakroom img').length > 0) { return; }
        $.each(slimages, function(k, v) {
          $('<img/>', { src: 'avatars/'+k, title: v }).appendTo('#cloakroom');
        });
        $('#cloakroom img').on('click', function() {
          avatar = $(this).attr('src');
          var title = $(this).attr('title');
          $('#myavatar').attr( { src: avatar, title: title });
          $('#avatarurl').val(avatar);
          setTimeout(function() { myuserdb.update({ avatar: avatar, title: title }); }, 10);
          $('#cloakroom').empty();
        });
        $('#avatarurl').on('change', function() {
          avatar = $.trim($('#avatarurl').val());
          $('#myavatar').attr( { src: avatar, title: id });
          setTimeout(function() { myuserdb.update({ avatar: avatar, title: '' }); }, 10);
          $('#cloakroom').empty();
        });
      });

    }); // end Profile

    function cancelprofile() {
      $('#profile').off('click', 'img.close', cancelprofile).hide(300);
    }

    // Hall of Shame
    $('#others').click(function() {
      if ($('#shame:visible').length) { cancelshame(); return false; }
      var table = '<img class="close" src="img/close_icon.gif" />'+
          '<table><tr><td><img src="img/eye.gif" width="73" height="63" /></td><td id="hos">Hall Of Shame</td></tr>';
      shame.sort(comptime);
      var now = new Date();
      $.each(shame, function(i, v) {
        var count = v.status === undefined ? (!v.offline || v.online > v.offline ? 1 : 0) : Object.keys(v.status).length;
        // v.online > (v.offline || v.online - 10);
        table += '<tr class="'+(count > 0 ? 'uonline' : 'uoffline') +'"><td>' + v.name + '</td><td>' +
            (count > 0 ? 'online '+(count > 1 ? '(&times;'+count+') ' : '')+'for '+
            deltaTime(now - (v.status !== undefined ? oldestconnect(v.status) : v.online)) :
            'offline for '+deltaTime(now - (v.offline || v.online))) +
            '</td></tr>';
      });
      $('#shame').show().on('click', 'img.close', cancelshame).html(table + '</table>');
    }); // end Hall of Shame

    function cancelshame() {
      $('#shame').off('click', 'img.close', cancelshame).hide(300);
    }

    function oldestconnect(st) {
      var oldest = (new Date()).valueOf();
      $.each(st, function(k, v) {
        if (typeof v === 'number') {
          if (v < oldest) { oldest = v; }
        } else {
          if (v.time < oldest) { oldest = v.time; }
        }
      });
      return oldest;
    }

    function comptime(a, b) { // for sorting times in Hall of Shame
      var aon = a.status !== undefined ? Object.keys(a.status).length > 0 : (!a.offline || a.online > a.offline);
      var bon = b.status !== undefined ? Object.keys(b.status).length > 0 : (!b.offline || b.online > b.offline);
      if (aon && bon) { // both are online
        return (b.status !== undefined ? oldestconnect(b.status) : b.online) -
            (a.status !== undefined ? oldestconnect(a.status) : a.online);
      }
      if (aon) { return -1; } // only a online
      if (bon) { return 1; }  // only b online
      return b.offline - a.offline; // both offline
    }

    // manage list of online users
    // should use 'child changed' event instead of reprocessing the entire value !!!
    onoffdb.on('value', function(snap) {
      var list = '';
      var lurker = '';
      var lurktime = 0;
      shame = [];
      snap.forEach(function(csnap) {
        var name = csnap.key();
        var v = csnap.val();
        shame.push({ name: name, online: v.online, offline: v.offline, status: v.status });
        if (name !== id) {  // not me
          if (v.status === undefined ? (!v.offline || v.online > v.offline) : Object.keys(v.status).length > 0) { // is online
            list += (list.length === 0 ? ' ' : ', ')+name;  // list of online users
          } else {
            var offnum = +v.offline;
            if (lurktime < offnum) { // most recent lurker
              lurker = name;
              lurktime = offnum;
            }
          }
        }
      });
      $('#others').text(list.length > 0 ? 'On: ' + list :
        'Last lurk: ' + (lurktime === 0 ? 'none' : lurker ));
    });

    $('#logo').click(function() {
      if ($('#helpdiv:visible').length) { $('#helpdiv').hide(300); return false; }
      $('#helpdiv').show().one('click', function() {
        $('#helpdiv').hide(300);
      });
    });

    // get client domain or IP address
    $.getJSON('client.php', function(data) {
      client = $.trim(data.client);
    });

    // get script URL of Slims
    $('.scripturl').text(window.location.href.replace(/\?.*$/, ''));

  }); // end document ready

  function pl(v) { // plural
    return ((v !== 1) ? 's' : '');
  }

  function deltaTime(d) { // how long ago?
    d /= 1000;
    if (d<0) { d = -d; }
    var year = Math.floor(d/31536000);
    var week = Math.floor((d%31536000)/604800);
    if (1<=year) { return year+' year'+pl(year)+' '+week+' week'+pl(week); }
    var weekday = Math.floor((d%604800)/86400);
    var day = Math.floor(d/86400);
    if (30<day) { return week+' week'+pl(week)+' '+weekday+' day'+pl(weekday); }
    var hour = Math.floor((d%86400)/3600);
    if (1<=day) { return day+' day'+pl(day)+' '+hour+' hour'+pl(hour); }
    var minute = Math.floor((d%3600)/60);
    if (1<=hour) { return hour+' hour'+pl(hour)+' '+minute+' minute'+pl(minute); }
    var second = Math.floor(d%60);
    if (1<=minute) { return minute+' minute'+pl(minute)+' '+second+' second'+pl(second); }
    var tenth = Math.floor((d%1)*10);
    var hund = Math.floor(((d*10)%1)*10);
    return second+((second<10)?('.'+tenth+(second===0?hund:'')):'')+' seconds';
  }

  function uptime() {  // update message times
    var now = new Date();
    $('.msgtime').each(function() {
      var el = $(this);
      el.html('<time>'+deltaTime(now-el.data('mts'))+' ago</time>');
    });
    if ($('#usertime').text() !== 'Offline') {
      $('#usertime').html('<time>'+now.toLocaleTimeString()+'</time>').attr('title', now.toLocaleDateString());
    }
    // console.log('num messages:', $('.msgtime').length, Object.keys(messageBodies).length);
  }

  function settitle() {
    document.title = unseen ? 'Slims ('+unseen+')' : 'Jack Rabbit Slims';
  }


  function setCookie(name, value) {
    var date = new Date();
    date.setTime(date.getTime() + 730*86400000); // 2 years
    document.cookie = name+'='+value+'; expires='+date.toGMTString()+'; path='+window.location.pathname;
  }

  // functions for manipulating and formatting messages
  function insert(str) {  // insert str into message
    var el = $('#messageInput')[0];
    el.focus();
    if (el.setSelectionRange) { // not IE
      var ss = el.selectionStart;
      el.value = el.value.substring(0, ss) + str + el.value.substring(el.selectionEnd, el.value.length);
      el.selectionStart = el.selectionEnd = ss + str.length;
    } else {  // IE
      document.selection.createRange().text = str;
    }
  }

  function wrap(ts, te) { // wrap message text selection in tags ts and te
    var el = $('#messageInput')[0];
    el.focus();
    if (el.setSelectionRange) { // not IE
      var ss = el.selectionStart;
      var se = el.selectionEnd;
      var sel = el.value.substring(ss, se);
      el.value = el.value.substring(0, ss) + ts + sel + te + el.value.substring(se, el.value.length);
      el.selectionStart = el.selectionEnd = ss + ts.length + (sel.length === 0 ? 0 : sel.length + te.length);
    } else {  // IE
      var selected = document.selection.createRange().text;
      document.selection.createRange().text = ts + selected + te;
    }
  }

  function img() {  // insert image tag into message
    var el = $('#messageInput')[0];
    el.focus();
    if (el.setSelectionRange) { // not IE
      var ss = el.selectionStart;
      var se = el.selectionEnd;
      var sel = el.value.substring(ss, se);
      if (sel.length === 0) { sel = prompt('Enter Image URL:', 'http://'); }
      if (!sel) { return; }
      var tag = ' <img src="' + sel + '" /> ';
      el.value = el.value.substring(0, ss) + tag + el.value.substring(se, el.value.length);
      el.selectionStart = el.selectionEnd = ss + tag.length;
    } else {  // IE
      var selected = document.selection.createRange().text;
      if (selected.length === 0) { selected = prompt('Enter Image URL:', 'http://'); }
      if (!selected) { return; }
      document.selection.createRange().text = ' <img src="' + selected + '" /> ';
    }
  }

  function alink() {  // insert link tag into message
    var el = $('#messageInput')[0];
    el.focus();
    var lurl = '';
    if (el.setSelectionRange) { // not IE
      var ss = el.selectionStart;
      var se = el.selectionEnd;
      var sel = el.value.substring(ss, se);
      if (sel.length === 0) { sel = lurl = prompt('Enter Link URL:', 'http://'); }
      else { lurl = prompt('Enter URL for '+ sel + ':', 'http://'); }
      if (!lurl) { return; }
      var tag = '<a href="' + lurl + '" target="_blank">' + sel + '</a>';
      el.value = el.value.substring(0, ss) + tag + el.value.substring(se, el.value.length);
      el.selectionStart = el.selectionEnd = ss + tag.length;
    } else {  // IE
      var selected = document.selection.createRange().text;
      if (selected.length === 0) { selected = lurl = prompt('Enter Link URL:', 'http://'); }
      else { lurl = prompt('Enter URL for ' + selected + ':', 'http://'); }
      if (!lurl) { return; }
      document.selection.createRange().text = '<a href="' + lurl + '" target="_blank">'+ selected + '</a>';
    }
  }

  function temperature(unit) {  // insert temperatures into message
    var el = $('#messageInput')[0];
    el.focus();
    if (el.setSelectionRange) { // not IE
      var ss = el.selectionStart;
      var se = el.selectionEnd;
      var sel = el.value.substring(ss, se);
      var m = ((sel.length === 0) ? el.value.substring(0, ss) : sel).match(/-?[\d.]+$/);
      var str = (m === null || m.length !== 1) ? '&deg;'+unit : (unit === 'C' ?
          (sel.length !== 0 ? m[0] : '') + '&deg;C (' + (Math.round((+m[0] * 18.0) + 320.0) / 10.0) + '&deg;F)' :
          (sel.length !== 0 ? m[0] : '') + '&deg;F (' + (Math.round((+m[0] - 32.0) * (50.0 / 9.0)) / 10.0) + '&deg;C)');
      el.value = el.value.substring(0, ss) + str + el.value.substring(el.selectionEnd, el.value.length);
      el.selectionStart = el.selectionEnd = ss + str.length;
    } else {  // IE
      var iesel = document.selection.createRange().text;
      document.selection.createRange().text = iesel.length === 0 ? '&deg'+unit : (unit === 'C' ?
          iesel + '&deg;C (' + (Math.round((+iesel * 18.0) + 320.0) / 10.0) + '&deg;F)' :
          iesel + '&deg;F (' + (Math.round((+iesel - 32.0) * (50.0 / 9.0)) / 10.0) + '&deg;C)');
    }
  }

  // regular expressions for finding URLs and Mail addresses
  // var urlRegex = /\b((?:[a-z][\w-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’]))/i;
  // var mailRegex = /\w+@[a-zA-Z_]+?(?:\.[a-zA-Z]{2,6})+/gim;
  var urlRegex = /^[ \t]*(\b(https?|ftp):\/\/[-A-Z0-9+&@#\*\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/i;
  var mailRegex = /^[ \t]*\w+@[a-zA-Z_]+?(?:\.[a-zA-Z]{2,6})+/i;

  var slimages = {
    'El0812.jpg': 'Ellen Hanrahan, El, Red',
    'Jen04.jpg': 'Jennifer K Longstaff, Jenn, jkl',
    'wm.jpg': 'Wm Leler',
    'lorenboston.jpg': 'Loren Lacy',
    'julie.gif': 'Julie Hardin',
    'wayne.gif': 'Wayne Hale, Zulu',
    'darroll.jpg': 'Darroll Evans, Buckwheat',
    'stilts.jpg': 'Dave Hill, Stiltskin',
    'kbh_2008.jpg': 'Kristen (Bendon) Hyman, Babe',
    'pippa.jpg': 'Pippa, Cyndy, dolliedish',
    'leslie11.jpg': 'Leslie, GeecheeGirl',
    'man.jpg': 'The Man',
    'happy.gif': 'Mr. Happy',
    'newuser.png': 'New User'
  };

}(jQuery));
