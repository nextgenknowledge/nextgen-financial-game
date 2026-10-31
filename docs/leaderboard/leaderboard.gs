/**
 * Fin City leaderboard: a Google Sheet that the game posts scores to and reads the top players
 * from. Paste this whole file into the sheet's Extensions > Apps Script editor and deploy it as a
 * web app (see docs/LEADERBOARD.md).
 *
 * Each player's world has one row, updated when they post again. To remove someone from the
 * board, put an x in their Hidden column (deleting the row works too, but they could post again).
 */

var SHEET_NAME = 'Scores';
var HEADERS = ['World id', 'Nickname', 'Level', 'Net worth', 'Mode', 'Updated', 'Hidden'];
var TOP = 50;

// Same rules as the game (src/game/leaderboard.ts)
var BLOCKED = [
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'asshole', 'bastard', 'slut', 'whore', 'piss',
  'penis', 'vagina', 'boob', 'tits', 'porn', 'sex', 'nude', 'naked', 'rape', 'nazi', 'hitler', 'kkk',
  'nigg', 'fag', 'retard', 'kys', 'killyourself', 'wank', 'twat', 'prick', 'dildo'
];

function fold_(s) {
  return String(s)
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1|!|\|/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4|@/g, 'a')
    .replace(/5|\$/g, 's')
    .replace(/7/g, 't')
    .replace(/[^a-z]/g, '');
}

function nicknameOk_(n) {
  n = String(n || '').trim();
  if (n.length < 2 || n.length > 16 || !/^[A-Za-z0-9 _.-]+$/.test(n)) return false;
  var f = fold_(n);
  for (var i = 0; i < BLOCKED.length; i++) if (f.indexOf(BLOCKED[i]) >= 0) return false;
  return true;
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** The game posts { id, nickname, level, netWorth, difficulty } as plain text. */
function doPost(e) {
  var s;
  try {
    s = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad json' });
  }
  var id = String(s.id || '');
  var level = Math.round(Number(s.level));
  var nw = Math.round(Number(s.netWorth));
  var mode = s.difficulty === 'advanced' ? 'advanced' : s.difficulty === 'entry' ? 'entry' : '';
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(id) || !nicknameOk_(s.nickname) || !mode) return json_({ ok: false, error: 'rejected' });
  if (!(level >= 1 && level <= 500) || !(nw >= 0 && nw <= 1e10)) return json_({ ok: false, error: 'rejected' });

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = sheet_();
    var values = sh.getDataRange().getValues();
    var row = [id, String(s.nickname).trim(), level, nw, mode, new Date(), ''];
    for (var r = 1; r < values.length; r++) {
      if (String(values[r][0]) === id) {
        if (String(values[r][6]).trim()) return json_({ ok: false, error: 'hidden' }); // removed by a teacher
        sh.getRange(r + 1, 1, 1, 6).setValues([row.slice(0, 6)]);
        return json_({ ok: true });
      }
    }
    sh.appendRow(row);
    return json_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

/** The game reads ?difficulty=entry|advanced and gets the top players, richest first. */
function doGet(e) {
  var mode = e && e.parameter && e.parameter.difficulty === 'advanced' ? 'advanced' : 'entry';
  var values = sheet_().getDataRange().getValues();
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var v = values[r];
    if (String(v[6]).trim() || v[4] !== mode || !nicknameOk_(v[1])) continue;
    rows.push({ id: String(v[0]), nickname: String(v[1]), level: Number(v[2]), netWorth: Number(v[3]), difficulty: mode });
  }
  rows.sort(function (a, b) {
    return b.netWorth - a.netWorth || b.level - a.level;
  });
  return json_({ rows: rows.slice(0, TOP) });
}
