Jack Rabbit Slims
=================

This is the latest incarnation of the oldest running private chat room on the web.
It is written almost entirely in JavaScript, with just a few small server utilities in PHP.

The data is stored in Firebase.  See https://www.firebase.com

Fine Uploader
=============

Uses Fine Uploader to allow drag and drop file uploading. See http://fineuploader.com

Here are all the files associated with Fine Uploader:

* all.fineuploader-3.8.2.min.js
* fineuploader-3.8.2.min.css
* endpoint.php
* handler.php
* edit.gif
* loading.gif
* processing.gif

Files and Directories
=====================

In addition to the files associated with Fine Uploader, here are the rest of the files and directories and what they do:

* avatars/ -- holds avatar icons for the users
* client.php -- simple PHP server utility to return the domain and IP address of the client
* delete.php -- simple PHP server utility to delete files uploaded by Fine Uploader when their messages expire
* emoticons/ -- holds emoticon images
* favicon.ico -- jrslims.com bookmark icon
* files/ -- holds files uploaded by Fine Uploader
* htaccess -- currently not used
* img/ -- image files used by slims
* index.html -- main slims html file
* README.md -- this file
* slims.js -- the main guts of slims

The htaccess file was an attempt to make it so that bookmarks like http://foo.com/slims?id=jack could be changed to http://foo.com/slims/jack

Installation
============

Simply upload all files onto a web server (you can leave out htaccess for now).  The web server must support PHP.
Easy peasy!

Configuration
=============

If you want to add new avatar icons, add the image to the avatars directory and update the slimages object at the end of slims.js
Avatar icons should be 39 pixels wide by 50 pixels high.  They work best if the contrast is cranked up.

If you want to add new emoticons, add them to the emoticons directory and add an image tag to index.html
