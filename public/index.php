<?php
// Cloudways Custom PHP applications may prefer index.php as the directory index.
// Keep the actual static page in index.html so GitHub Pages and Cloudways share one source.
readfile(__DIR__ . '/index.html');
