<?php
// Written by Wm Leler
echo '{ "client": "'.gethostbyaddr($_SERVER['REMOTE_ADDR']).
	'", "clientIP": "'.$_SERVER['REMOTE_ADDR'].
	'", "clientHost": "'.$_SERVER['REMOTE_HOST'].
	'", "clientPort": "'.$_SERVER['REMOTE_PORT'].
	'", "server": "'.'http://'.$_SERVER['SERVER_NAME'].dirname($_SERVER['REQUEST_URI']).'/'.
	'", "serverName": "'. $_SERVER['SERVER_NAME'].
	'", "serverIP": "'. $_SERVER['SERVER_ADDR'].
	'", "serverPort": "'. $_SERVER['SERVER_PORT'].
	'", "serverPath": "'. $_SERVER['PHP_SELF'].
	'", "serverDir": "'. dirname($_SERVER['PHP_SELF']).'/'.
	'", "serverQuery": "'. $_SERVER['QUERY_STRING'].
	'", "time": '. $_SERVER['REQUEST_TIME'].
	', "URI": "'. $_SERVER['REQUEST_URI'].
	'", "referer": "'. $_SERVER['HTTP_REFERER'].'" } ';
?>