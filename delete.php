<?php
// http:delete?file=directory/abc.def
// deletes file files/directory/abc.def
// and directory
// Written by Wm Leler

if ($_GET['file'] === NULL) { return; }
$file = htmlspecialchars($_GET['file']);
$filepath = 'files/'.$file;
if (unlink($filepath)) {
	echo $filepath.' file deleted<br>';
}
$subs = explode('/', $file);
$filepath = 'files/'.$subs[0];
if (count($subs) === 2 && rmdir($filepath)) {
	echo $filepath.' directory removed<br>';
}
?>
