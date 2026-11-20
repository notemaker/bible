<?php
// LINE requires a direct HTTP 200 response. Apps Script Web Apps commonly
// answer with a 302 redirect, so Cloudways forwards the event and answers 200.
$appsScriptUrl = 'https://script.google.com/macros/s/AKfycbywV6iqZ3yV5qlmpejFtsy6QmhdABj4yqLIqIf4LQyI-6knsrmPjOa5wNJYbf1Zg7Th0A/exec';
$body = file_get_contents('php://input');
$context = stream_context_create([
  'http' => [
    'method' => 'POST',
    'header' => "Content-Type: application/json\r\n",
    'content' => $body,
    'timeout' => 15,
    'ignore_errors' => true,
    'follow_location' => 1,
    'max_redirects' => 5,
  ],
]);
@file_get_contents($appsScriptUrl, false, $context);
http_response_code(200);
header('Content-Type: text/plain; charset=utf-8');
echo 'OK';
