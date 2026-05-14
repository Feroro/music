<?php
// === Gemini API 中継プログラム ===
header('Content-Type: application/json; charset=utf-8');

// ★ここにあなたのGemini APIキーを入力してください
$apiKey = 'AIzaSyB9G38K_LAq6nwzf5WHdKVq6vidkVewgNQ';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Methods: POST, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type");
    exit(0);
}

// POSTデータの取得
$json = file_get_contents('php://input');
$data = json_decode($json, true);
$todoText = $data['todoText'] ?? '';

if (empty($todoText)) {
    http_response_code(400);
    echo json_encode(['error' => 'Task is empty']);
    exit;
}

// プロンプトの生成
$promptText = "あなたは優秀なタスク管理アシスタントです。\nユーザーが入力したタスク「" . $todoText . "」を、ADHDの人でもすぐに行動に移せるように極限まで細分化してください。\n条件：\n1. 1つのステップは「5分以内」で終わる極小サイズにすること。\n2. 最初のステップは「深呼吸する」「ブラウザを開く」など、脳への負荷がゼロの物理的なアクションにすること。\n3. すべて「- [ ] (やること)」のマークダウン形式のチェックリストとして出力すること。\n4. 前置きや後書きは不要です。チェックリストのみを出力してください。";

$url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" . $apiKey;

$payload = [
    "contents" => [
        [
            "parts" => [
                ["text" => $promptText]
            ]
        ]
    ]
];

// Gemini APIへcURLでリクエスト送信
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
// SSL証明書エラーを回避するための設定（サーバー環境によっては必要）
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200) {
    http_response_code($httpCode);
    echo json_encode([
        'error' => 'API request failed',
        'httpCode' => $httpCode,
        'details' => json_decode($response, true)
    ]);
    exit;
}

// 正常なレスポンスをブラウザに返す
echo $response;
