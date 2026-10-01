-- 2026年10月2日の初期設定。チーム・演技台帳・予想対象だけを登録する。
-- 個人情報、口座、ベット、結果、ポイント、公開設定は含めない。
-- 種目別は競技の開始予定に締切。学年別も同じ競技の最初の開始時刻で締め切る。
-- 全体優勝は最初の得点競技（女子リレー）開始の9:10に締切。
-- 日時は+09:00の日本時間に対応。運営判断で/adminのMarket・進行から変更できる。
DO $setup$
begin
  if exists (select 1 from public.markets) then
    raise notice 'Marketは登録済みです。既存の設定を保持します'; return;
  end if;
  if exists (select 1 from public.teams) or exists (select 1 from public.events) then
    raise exception 'チーム・種目が登録済みです。管理画面で既存設定からMarketを作成してください';
  end if;
  if exists (select 1 from public.settings where final_settled_at is not null) then
    raise exception '最終精算済みのため初期設定を停止しました';
  end if;
  insert into public.teams select * from jsonb_populate_recordset(null::public.teams, $data$[
  {
    "id": "t1",
    "num": "01",
    "name": "1組 黄色",
    "color": "#ffe600",
    "sort_order": 1
  },
  {
    "id": "t2",
    "num": "02",
    "name": "2組 水色",
    "color": "#87ceeb",
    "sort_order": 2
  },
  {
    "id": "t3",
    "num": "03",
    "name": "3組 白",
    "color": "#ffffff",
    "sort_order": 3
  },
  {
    "id": "t4",
    "num": "04",
    "name": "4組 赤",
    "color": "#d92b2b",
    "sort_order": 4
  },
  {
    "id": "t5",
    "num": "05",
    "name": "5組 橙",
    "color": "#ec7a1c",
    "sort_order": 5
  },
  {
    "id": "t6",
    "num": "06",
    "name": "6組 桃色",
    "color": "#ff6fb5",
    "sort_order": 6
  },
  {
    "id": "t7",
    "num": "07",
    "name": "7組 緑",
    "color": "#1f9d55",
    "sort_order": 7
  },
  {
    "id": "t8",
    "num": "08",
    "name": "8組 青",
    "color": "#1f6fd0",
    "sort_order": 8
  }
]$data$::jsonb);
  insert into public.events select * from jsonb_populate_recordset(null::public.events, $data$[
  {
    "id": "ev-01",
    "no": "01",
    "name": "開会式",
    "en": "OPENING CEREMONY",
    "kind": "ceremony",
    "category": "field",
    "start_time": "2026-10-02T08:45:00+09:00",
    "delay_min": 0,
    "location": "フィールド（本部側）",
    "entries": [],
    "rank_points": [],
    "heats": [
      {
        "id": "all",
        "label": "総合"
      }
    ],
    "sort_order": 1,
    "participants": "全員参加",
    "gather_start": "8:20 グラウンド集合",
    "gather_place": "フィールド（本部側）",
    "belongings": "（なし）",
    "formation": "grid",
    "formation_note": "本部に向かって右から1年→2年→3年、右から1組→8組。出席番号順に2列",
    "description": "8:20 にグラウンドへ集合し、各クラス体育祭委員を先頭に出席番号順2列で整列する。8:30 に整列・点呼完了（厳守）、8:40 に選手変更手続き完了、8:45 から開会式。開会宣言・国歌斉唱（諸旗掲揚）・学校長挨拶・選手宣誓・諸注意の順に行う。必要なもの以外（弁当を含む）は教室に置いていく。"
  },
  {
    "id": "ev-02",
    "no": "02",
    "name": "準備体操",
    "en": "RADIO EXERCISE",
    "kind": "ceremony",
    "category": "field",
    "start_time": "2026-10-02T09:00:00+09:00",
    "delay_min": 0,
    "location": "フィールド（本部側）",
    "entries": [],
    "rank_points": [],
    "heats": [
      {
        "id": "all",
        "label": "総合"
      }
    ],
    "sort_order": 2,
    "participants": "全員参加",
    "gather_start": "開会式に続けて",
    "gather_place": "フィールド（本部側）",
    "belongings": "（なし）",
    "formation": "grid",
    "formation_note": "縦は2年5組右列、横は各組の体育祭実行委員が基準になり広がる",
    "description": "指揮台上の体育委員長の号令で「ラジオ体操第一」を行う全校演技。基準列が広がったあと全体が体操の隊形にひらき、体操後に元の隊形へ集まる。笛の合図で退場し、各クラステントへ直接移動する。"
  },
  {
    "id": "ev-03",
    "no": "03",
    "name": "女子6×100mリレー",
    "en": "GIRLS 6×100m RELAY",
    "kind": "track",
    "category": "race",
    "start_time": "2026-10-02T09:10:00+09:00",
    "delay_min": 0,
    "location": "トラック",
    "entries": [
      {
        "slot": "1コース",
        "teamId": "t5"
      },
      {
        "slot": "2コース",
        "teamId": "t2"
      },
      {
        "slot": "3コース",
        "teamId": "t8"
      },
      {
        "slot": "4コース",
        "teamId": "t1"
      },
      {
        "slot": "5コース",
        "teamId": "t6"
      },
      {
        "slot": "6コース",
        "teamId": "t3"
      },
      {
        "slot": "7コース",
        "teamId": "t7"
      },
      {
        "slot": "8コース",
        "teamId": "t4"
      }
    ],
    "rank_points": [
      20,
      18,
      16,
      14,
      13,
      12,
      11,
      10
    ],
    "heats": [
      {
        "id": "g1",
        "label": "1年"
      },
      {
        "id": "g2",
        "label": "2年"
      },
      {
        "id": "g3",
        "label": "3年"
      }
    ],
    "sort_order": 3,
    "participants": "クラス対抗",
    "gather_start": "準備体操退場後",
    "gather_place": "フィールド",
    "belongings": "アンカーはクラス番号のゼッケン",
    "formation": "track",
    "formation_note": "1,3,5走は本部側、2,4,6走はバックストレート側に整列",
    "description": "一発決勝。1年→2年→3年の順でレースを行い、各学年で順位を決定する。1人トラック半周(100m)を6人でリレー。バトンパスはゾーン内で行い、ゾーン外のパスは失格。オープン制・コーナートップ制を用いる。"
  },
  {
    "id": "ev-04",
    "no": "04",
    "name": "男子スウェーデンリレー",
    "en": "BOYS SWEDEN RELAY",
    "kind": "track",
    "category": "race",
    "start_time": "2026-10-02T09:25:00+09:00",
    "delay_min": 0,
    "location": "トラック",
    "entries": [
      {
        "slot": "1コース",
        "teamId": "t2"
      },
      {
        "slot": "2コース",
        "teamId": "t8"
      },
      {
        "slot": "3コース",
        "teamId": "t1"
      },
      {
        "slot": "4コース",
        "teamId": "t6"
      },
      {
        "slot": "5コース",
        "teamId": "t3"
      },
      {
        "slot": "6コース",
        "teamId": "t7"
      },
      {
        "slot": "7コース",
        "teamId": "t4"
      },
      {
        "slot": "8コース",
        "teamId": "t5"
      }
    ],
    "rank_points": [
      20,
      18,
      16,
      14,
      13,
      12,
      11,
      10
    ],
    "heats": [
      {
        "id": "g1",
        "label": "1年"
      },
      {
        "id": "g2",
        "label": "2年"
      },
      {
        "id": "g3",
        "label": "3年"
      }
    ],
    "sort_order": 4,
    "participants": "クラス対抗",
    "gather_start": "女子6×100mリレー退場後",
    "gather_place": "フィールド",
    "belongings": "アンカーはクラス番号のゼッケン",
    "formation": "track",
    "formation_note": "2,6走は本部側、1,3,4,5走はバックストレート側",
    "description": "一発決勝。1年→2年→3年の順でレースを行い、各学年で順位を決定する。1・2走100m、3・4走200m、5走300m、6走400mをリレーする。スタートは生徒席側。バトンパスはゾーン内で行い、ゾーン外のパスは失格。"
  },
  {
    "id": "ev-05",
    "no": "05",
    "name": "男女混合リレー",
    "en": "MIXED RELAY",
    "kind": "track",
    "category": "race",
    "start_time": "2026-10-02T09:45:00+09:00",
    "delay_min": 0,
    "location": "トラック",
    "entries": [
      {
        "slot": "1コース",
        "teamId": "t8"
      },
      {
        "slot": "2コース",
        "teamId": "t1"
      },
      {
        "slot": "3コース",
        "teamId": "t6"
      },
      {
        "slot": "4コース",
        "teamId": "t3"
      },
      {
        "slot": "5コース",
        "teamId": "t7"
      },
      {
        "slot": "6コース",
        "teamId": "t4"
      },
      {
        "slot": "7コース",
        "teamId": "t5"
      },
      {
        "slot": "8コース",
        "teamId": "t2"
      }
    ],
    "rank_points": [
      25,
      23,
      21,
      19,
      17,
      15,
      13,
      11
    ],
    "heats": [
      {
        "id": "g1",
        "label": "1年"
      },
      {
        "id": "g2",
        "label": "2年"
      },
      {
        "id": "g3",
        "label": "3年"
      }
    ],
    "sort_order": 5,
    "participants": "クラス対抗",
    "gather_start": "男子スウェーデンリレー退場後",
    "gather_place": "フィールド",
    "belongings": "アンカーはクラス番号のゼッケン",
    "formation": "track",
    "formation_note": "1,3,5,7,8走は本部側、2,4,6走はバックストレート側",
    "description": "一発決勝。1年→2年→3年の順でレースを行い、各学年で順位を決定する。各クラス男女各4名の8人で、1〜6走は100m、7〜8走は200mをリレーする。1〜6走に男女各3人、7〜8走に男女各1人を配し、性別による走順は問わない。"
  },
  {
    "id": "ev-06",
    "no": "06",
    "name": "玉入れ",
    "en": "TAMA-IRE",
    "kind": "field",
    "category": "field",
    "start_time": "2026-10-02T10:05:00+09:00",
    "delay_min": 0,
    "location": "フィールド",
    "entries": [],
    "rank_points": [],
    "heats": [
      {
        "id": "all",
        "label": "総合"
      }
    ],
    "sort_order": 6,
    "participants": "クラス対抗",
    "gather_start": "男子スウェーデンリレー退場後",
    "gather_place": "フィールド",
    "belongings": "クラスカラーのハチマキ。玉出し要員は赤白帽子",
    "formation": "ball",
    "formation_note": "半径3mの円を2つ設置。円内競技者は円内へ、円外の競技者は円の周りへ",
    "description": "1チーム24名（各学年8名）。第1試合 1組 vs 2組、第2試合 3組 vs 4組、第3試合 5組 vs 6組、第4試合 7組 vs 8組。前半1分はお題に沿った玉入れ、後半1分はなんでもあり。通常玉1点、レア玉（シャトル）10点。"
  },
  {
    "id": "ev-07",
    "no": "07",
    "name": "部行進",
    "en": "CLUB PARADE",
    "kind": "club",
    "category": "field",
    "start_time": "2026-10-02T12:00:00+09:00",
    "delay_min": 0,
    "location": "フィールド",
    "entries": [],
    "rank_points": [],
    "heats": [
      {
        "id": "all",
        "label": "総合"
      }
    ],
    "sort_order": 7,
    "participants": "部活動",
    "gather_start": "昼休み10分前",
    "gather_place": "フィールド（バックストレート側）",
    "belongings": "部のユニフォーム・プラカード",
    "formation": "parade",
    "formation_note": "部活ごとに1〜21の順。10人未満は1列、以降は人数に応じて2〜4列",
    "description": "全運動部が参加する（3年生は任意）。各部プラカードを先頭に、1〜21の順でバックストレート側に観覧隊形で整列する。校長先生の登壇後、一部活ずつ間隔をあけて入場し、停止線に着いた部から停止する。オープニングはダンス部によるチアダンス。"
  },
  {
    "id": "ev-08",
    "no": "08",
    "name": "部対抗リレー",
    "en": "CLUB RELAY",
    "kind": "club",
    "category": "field",
    "start_time": "2026-10-02T12:30:00+09:00",
    "delay_min": 0,
    "location": "トラック",
    "entries": [],
    "rank_points": [],
    "heats": [
      {
        "id": "all",
        "label": "総合"
      }
    ],
    "sort_order": 8,
    "participants": "部活動",
    "gather_start": "部行進退場後",
    "gather_place": "フィールド（本部側）",
    "belongings": "ユニフォーム。パフォーマンスリレーのみ部に関連した道具をバトン代わりにできる",
    "formation": "lane",
    "formation_note": "フィールド本部側でパフォーマンス→女子①→女子②→男子①→男子②の順に並ぶ",
    "description": "パフォーマンスリレー(1周)→女子レース1(200m×4)→女子レース2(200m×4)→男子レース1(200m×4)→男子レース2(200m×4)の順で行う。ユニフォームで走る。部に関連した道具をバトン代わりにできるのはパフォーマンスリレーのみ。"
  },
  {
    "id": "ev-09",
    "no": "09",
    "name": "大縄跳び",
    "en": "LONG ROPE JUMP",
    "kind": "field",
    "category": "field",
    "start_time": "2026-10-02T13:25:00+09:00",
    "delay_min": 0,
    "location": "フィールド",
    "entries": [],
    "rank_points": [
      25,
      21,
      18,
      16,
      13,
      12,
      11,
      10
    ],
    "heats": [
      {
        "id": "g1",
        "label": "1年"
      }
    ],
    "sort_order": 9,
    "participants": "1年生全員",
    "gather_start": "部対抗リレー終了15分後（更衣休憩後）",
    "gather_place": "フィールド",
    "belongings": "（なし）",
    "formation": "rope",
    "formation_note": "ロープの東側に本部の方を向いて2列で整列して座る",
    "description": "1年生全員の学年競技。クラスを半分に分け、1チーム20人（回し手2名込み）で八の字跳びと全員跳びを行う。制限時間は各1分30秒で、競技前に30秒の自由練習がある。八の字跳び・全員跳びそれぞれの回数にポイントを付け、その総合ポイントで順位を決定する。"
  },
  {
    "id": "ev-10",
    "no": "10",
    "name": "棒引き",
    "en": "BOU-HIKI",
    "kind": "field",
    "category": "field",
    "start_time": "2026-10-02T13:35:00+09:00",
    "delay_min": 0,
    "location": "フィールド",
    "entries": [],
    "rank_points": [],
    "heats": [
      {
        "id": "all",
        "label": "総合"
      }
    ],
    "sort_order": 10,
    "participants": "2年生全員",
    "gather_start": "大縄跳び退場後",
    "gather_place": "フィールド",
    "belongings": "軍手",
    "formation": "pole",
    "formation_note": "棒の後ろに縦1列。複数試合に出る選手は前試合終了後すぐ次の位置へ",
    "description": "1,3,5回戦は女子、2,4,6回戦は男子。1・2回戦は棒を持った状態から、3・4回戦は4m地点から走って取りに行く。5・6回戦は各クラスの選抜2人×2チーム。各チーム両端6m地点の線を棒の端が越えた時点で勝負あり。勝ち3点、引き分け1点、負け0点。"
  },
  {
    "id": "ev-11",
    "no": "11",
    "name": "騎馬戦",
    "en": "KIBASEN",
    "kind": "field",
    "category": "field",
    "start_time": "2026-10-02T13:55:00+09:00",
    "delay_min": 0,
    "location": "フィールド",
    "entries": [],
    "rank_points": [
      25,
      21,
      18,
      16,
      13,
      12,
      11,
      10
    ],
    "heats": [
      {
        "id": "all",
        "label": "総合"
      }
    ],
    "sort_order": 11,
    "participants": "3年生全員",
    "gather_start": "玉入れ退場後",
    "gather_place": "フィールド",
    "belongings": "赤白帽・軍手。上に乗る人は裸足。紅白大将ははっぴ",
    "formation": "horse",
    "formation_note": "1回戦の出場騎馬は各サークルの待機位置に整列。紅組は時計回りに次のコートへ",
    "description": "1回戦は紅白に分かれたクラス対抗総当たり戦（女子→男子）で、第1試合から第4試合まで行う。2回戦は紅白の大将戦で、相手の大将騎を先に倒した組の勝ち。帽子を取られるか騎馬が崩れたら負け。4分で決着がつかない場合は残騎数の多い方の勝ち。"
  },
  {
    "id": "ev-12",
    "no": "12",
    "name": "閉会式",
    "en": "CLOSING CEREMONY",
    "kind": "ceremony",
    "category": "field",
    "start_time": "2026-10-02T14:20:00+09:00",
    "delay_min": 0,
    "location": "フィールド（本部側）",
    "entries": [],
    "rank_points": [],
    "heats": [
      {
        "id": "all",
        "label": "総合"
      }
    ],
    "sort_order": 12,
    "participants": "全員参加",
    "gather_start": "騎馬戦退場後",
    "gather_place": "フィールド（本部側）",
    "belongings": "（なし）",
    "formation": "grid",
    "formation_note": "騎馬戦退場後いったん生徒席に着席し、放送で開会式と同じ隊形に整列",
    "description": "騎馬戦退場後、いったん生徒席に着席し、準備完了後に放送で開会式と同じ隊形へ整列・点呼する。成績発表・表彰（得賞歌）・学校長講評・諸旗降納と校歌斉唱・実行委員長挨拶・閉会宣言の順に行う。"
  }
]$data$::jsonb);
  insert into public.markets select * from jsonb_populate_recordset(null::public.markets, $data$[
  {
    "id": "day-ev-03-g1",
    "type": "event",
    "event_id": "ev-03",
    "heat_id": "g1",
    "category": "race",
    "no": "03",
    "title": "女子6×100mリレー 1年",
    "en": "GIRLS 6×100m RELAY 1年",
    "options": [
      {
        "id": "t1",
        "num": "01",
        "name": "1組 黄色"
      },
      {
        "id": "t2",
        "num": "02",
        "name": "2組 水色"
      },
      {
        "id": "t3",
        "num": "03",
        "name": "3組 白"
      },
      {
        "id": "t4",
        "num": "04",
        "name": "4組 赤"
      },
      {
        "id": "t5",
        "num": "05",
        "name": "5組 橙"
      },
      {
        "id": "t6",
        "num": "06",
        "name": "6組 桃色"
      },
      {
        "id": "t7",
        "num": "07",
        "name": "7組 緑"
      },
      {
        "id": "t8",
        "num": "08",
        "name": "8組 青"
      }
    ],
    "deadline": "2026-10-02T09:10:00+09:00",
    "status": "open",
    "result_order": null,
    "trifecta_odds_default": 50,
    "trifecta_odds_overrides": {}
  },
  {
    "id": "day-ev-03-g2",
    "type": "event",
    "event_id": "ev-03",
    "heat_id": "g2",
    "category": "race",
    "no": "03",
    "title": "女子6×100mリレー 2年",
    "en": "GIRLS 6×100m RELAY 2年",
    "options": [
      {
        "id": "t1",
        "num": "01",
        "name": "1組 黄色"
      },
      {
        "id": "t2",
        "num": "02",
        "name": "2組 水色"
      },
      {
        "id": "t3",
        "num": "03",
        "name": "3組 白"
      },
      {
        "id": "t4",
        "num": "04",
        "name": "4組 赤"
      },
      {
        "id": "t5",
        "num": "05",
        "name": "5組 橙"
      },
      {
        "id": "t6",
        "num": "06",
        "name": "6組 桃色"
      },
      {
        "id": "t7",
        "num": "07",
        "name": "7組 緑"
      },
      {
        "id": "t8",
        "num": "08",
        "name": "8組 青"
      }
    ],
    "deadline": "2026-10-02T09:10:00+09:00",
    "status": "open",
    "result_order": null,
    "trifecta_odds_default": 50,
    "trifecta_odds_overrides": {}
  },
  {
    "id": "day-ev-03-g3",
    "type": "event",
    "event_id": "ev-03",
    "heat_id": "g3",
    "category": "race",
    "no": "03",
    "title": "女子6×100mリレー 3年",
    "en": "GIRLS 6×100m RELAY 3年",
    "options": [
      {
        "id": "t1",
        "num": "01",
        "name": "1組 黄色"
      },
      {
        "id": "t2",
        "num": "02",
        "name": "2組 水色"
      },
      {
        "id": "t3",
        "num": "03",
        "name": "3組 白"
      },
      {
        "id": "t4",
        "num": "04",
        "name": "4組 赤"
      },
      {
        "id": "t5",
        "num": "05",
        "name": "5組 橙"
      },
      {
        "id": "t6",
        "num": "06",
        "name": "6組 桃色"
      },
      {
        "id": "t7",
        "num": "07",
        "name": "7組 緑"
      },
      {
        "id": "t8",
        "num": "08",
        "name": "8組 青"
      }
    ],
    "deadline": "2026-10-02T09:10:00+09:00",
    "status": "open",
    "result_order": null,
    "trifecta_odds_default": 50,
    "trifecta_odds_overrides": {}
  },
  {
    "id": "day-ev-04-g1",
    "type": "event",
    "event_id": "ev-04",
    "heat_id": "g1",
    "category": "race",
    "no": "04",
    "title": "男子スウェーデンリレー 1年",
    "en": "BOYS SWEDEN RELAY 1年",
    "options": [
      {
        "id": "t1",
        "num": "01",
        "name": "1組 黄色"
      },
      {
        "id": "t2",
        "num": "02",
        "name": "2組 水色"
      },
      {
        "id": "t3",
        "num": "03",
        "name": "3組 白"
      },
      {
        "id": "t4",
        "num": "04",
        "name": "4組 赤"
      },
      {
        "id": "t5",
        "num": "05",
        "name": "5組 橙"
      },
      {
        "id": "t6",
        "num": "06",
        "name": "6組 桃色"
      },
      {
        "id": "t7",
        "num": "07",
        "name": "7組 緑"
      },
      {
        "id": "t8",
        "num": "08",
        "name": "8組 青"
      }
    ],
    "deadline": "2026-10-02T09:25:00+09:00",
    "status": "open",
    "result_order": null,
    "trifecta_odds_default": 50,
    "trifecta_odds_overrides": {}
  },
  {
    "id": "day-ev-04-g2",
    "type": "event",
    "event_id": "ev-04",
    "heat_id": "g2",
    "category": "race",
    "no": "04",
    "title": "男子スウェーデンリレー 2年",
    "en": "BOYS SWEDEN RELAY 2年",
    "options": [
      {
        "id": "t1",
        "num": "01",
        "name": "1組 黄色"
      },
      {
        "id": "t2",
        "num": "02",
        "name": "2組 水色"
      },
      {
        "id": "t3",
        "num": "03",
        "name": "3組 白"
      },
      {
        "id": "t4",
        "num": "04",
        "name": "4組 赤"
      },
      {
        "id": "t5",
        "num": "05",
        "name": "5組 橙"
      },
      {
        "id": "t6",
        "num": "06",
        "name": "6組 桃色"
      },
      {
        "id": "t7",
        "num": "07",
        "name": "7組 緑"
      },
      {
        "id": "t8",
        "num": "08",
        "name": "8組 青"
      }
    ],
    "deadline": "2026-10-02T09:25:00+09:00",
    "status": "open",
    "result_order": null,
    "trifecta_odds_default": 50,
    "trifecta_odds_overrides": {}
  },
  {
    "id": "day-ev-04-g3",
    "type": "event",
    "event_id": "ev-04",
    "heat_id": "g3",
    "category": "race",
    "no": "04",
    "title": "男子スウェーデンリレー 3年",
    "en": "BOYS SWEDEN RELAY 3年",
    "options": [
      {
        "id": "t1",
        "num": "01",
        "name": "1組 黄色"
      },
      {
        "id": "t2",
        "num": "02",
        "name": "2組 水色"
      },
      {
        "id": "t3",
        "num": "03",
        "name": "3組 白"
      },
      {
        "id": "t4",
        "num": "04",
        "name": "4組 赤"
      },
      {
        "id": "t5",
        "num": "05",
        "name": "5組 橙"
      },
      {
        "id": "t6",
        "num": "06",
        "name": "6組 桃色"
      },
      {
        "id": "t7",
        "num": "07",
        "name": "7組 緑"
      },
      {
        "id": "t8",
        "num": "08",
        "name": "8組 青"
      }
    ],
    "deadline": "2026-10-02T09:25:00+09:00",
    "status": "open",
    "result_order": null,
    "trifecta_odds_default": 50,
    "trifecta_odds_overrides": {}
  },
  {
    "id": "day-ev-05-g1",
    "type": "event",
    "event_id": "ev-05",
    "heat_id": "g1",
    "category": "race",
    "no": "05",
    "title": "男女混合リレー 1年",
    "en": "MIXED RELAY 1年",
    "options": [
      {
        "id": "t1",
        "num": "01",
        "name": "1組 黄色"
      },
      {
        "id": "t2",
        "num": "02",
        "name": "2組 水色"
      },
      {
        "id": "t3",
        "num": "03",
        "name": "3組 白"
      },
      {
        "id": "t4",
        "num": "04",
        "name": "4組 赤"
      },
      {
        "id": "t5",
        "num": "05",
        "name": "5組 橙"
      },
      {
        "id": "t6",
        "num": "06",
        "name": "6組 桃色"
      },
      {
        "id": "t7",
        "num": "07",
        "name": "7組 緑"
      },
      {
        "id": "t8",
        "num": "08",
        "name": "8組 青"
      }
    ],
    "deadline": "2026-10-02T09:45:00+09:00",
    "status": "open",
    "result_order": null,
    "trifecta_odds_default": 50,
    "trifecta_odds_overrides": {}
  },
  {
    "id": "day-ev-05-g2",
    "type": "event",
    "event_id": "ev-05",
    "heat_id": "g2",
    "category": "race",
    "no": "05",
    "title": "男女混合リレー 2年",
    "en": "MIXED RELAY 2年",
    "options": [
      {
        "id": "t1",
        "num": "01",
        "name": "1組 黄色"
      },
      {
        "id": "t2",
        "num": "02",
        "name": "2組 水色"
      },
      {
        "id": "t3",
        "num": "03",
        "name": "3組 白"
      },
      {
        "id": "t4",
        "num": "04",
        "name": "4組 赤"
      },
      {
        "id": "t5",
        "num": "05",
        "name": "5組 橙"
      },
      {
        "id": "t6",
        "num": "06",
        "name": "6組 桃色"
      },
      {
        "id": "t7",
        "num": "07",
        "name": "7組 緑"
      },
      {
        "id": "t8",
        "num": "08",
        "name": "8組 青"
      }
    ],
    "deadline": "2026-10-02T09:45:00+09:00",
    "status": "open",
    "result_order": null,
    "trifecta_odds_default": 50,
    "trifecta_odds_overrides": {}
  },
  {
    "id": "day-ev-05-g3",
    "type": "event",
    "event_id": "ev-05",
    "heat_id": "g3",
    "category": "race",
    "no": "05",
    "title": "男女混合リレー 3年",
    "en": "MIXED RELAY 3年",
    "options": [
      {
        "id": "t1",
        "num": "01",
        "name": "1組 黄色"
      },
      {
        "id": "t2",
        "num": "02",
        "name": "2組 水色"
      },
      {
        "id": "t3",
        "num": "03",
        "name": "3組 白"
      },
      {
        "id": "t4",
        "num": "04",
        "name": "4組 赤"
      },
      {
        "id": "t5",
        "num": "05",
        "name": "5組 橙"
      },
      {
        "id": "t6",
        "num": "06",
        "name": "6組 桃色"
      },
      {
        "id": "t7",
        "num": "07",
        "name": "7組 緑"
      },
      {
        "id": "t8",
        "num": "08",
        "name": "8組 青"
      }
    ],
    "deadline": "2026-10-02T09:45:00+09:00",
    "status": "open",
    "result_order": null,
    "trifecta_odds_default": 50,
    "trifecta_odds_overrides": {}
  },
  {
    "id": "day-ev-06-all",
    "type": "event",
    "event_id": "ev-06",
    "heat_id": "all",
    "category": "field",
    "no": "06",
    "title": "玉入れ",
    "en": "TAMA-IRE",
    "options": [
      {
        "id": "t1",
        "num": "01",
        "name": "1組 黄色"
      },
      {
        "id": "t2",
        "num": "02",
        "name": "2組 水色"
      },
      {
        "id": "t3",
        "num": "03",
        "name": "3組 白"
      },
      {
        "id": "t4",
        "num": "04",
        "name": "4組 赤"
      },
      {
        "id": "t5",
        "num": "05",
        "name": "5組 橙"
      },
      {
        "id": "t6",
        "num": "06",
        "name": "6組 桃色"
      },
      {
        "id": "t7",
        "num": "07",
        "name": "7組 緑"
      },
      {
        "id": "t8",
        "num": "08",
        "name": "8組 青"
      }
    ],
    "deadline": "2026-10-02T10:05:00+09:00",
    "status": "open",
    "result_order": null,
    "trifecta_odds_default": 50,
    "trifecta_odds_overrides": {}
  },
  {
    "id": "day-ev-09-g1",
    "type": "event",
    "event_id": "ev-09",
    "heat_id": "g1",
    "category": "field",
    "no": "09",
    "title": "大縄跳び",
    "en": "LONG ROPE JUMP",
    "options": [
      {
        "id": "t1",
        "num": "01",
        "name": "1組 黄色"
      },
      {
        "id": "t2",
        "num": "02",
        "name": "2組 水色"
      },
      {
        "id": "t3",
        "num": "03",
        "name": "3組 白"
      },
      {
        "id": "t4",
        "num": "04",
        "name": "4組 赤"
      },
      {
        "id": "t5",
        "num": "05",
        "name": "5組 橙"
      },
      {
        "id": "t6",
        "num": "06",
        "name": "6組 桃色"
      },
      {
        "id": "t7",
        "num": "07",
        "name": "7組 緑"
      },
      {
        "id": "t8",
        "num": "08",
        "name": "8組 青"
      }
    ],
    "deadline": "2026-10-02T13:25:00+09:00",
    "status": "open",
    "result_order": null,
    "trifecta_odds_default": 50,
    "trifecta_odds_overrides": {}
  },
  {
    "id": "day-ev-10-all",
    "type": "event",
    "event_id": "ev-10",
    "heat_id": "all",
    "category": "field",
    "no": "10",
    "title": "棒引き",
    "en": "BOU-HIKI",
    "options": [
      {
        "id": "t1",
        "num": "01",
        "name": "1組 黄色"
      },
      {
        "id": "t2",
        "num": "02",
        "name": "2組 水色"
      },
      {
        "id": "t3",
        "num": "03",
        "name": "3組 白"
      },
      {
        "id": "t4",
        "num": "04",
        "name": "4組 赤"
      },
      {
        "id": "t5",
        "num": "05",
        "name": "5組 橙"
      },
      {
        "id": "t6",
        "num": "06",
        "name": "6組 桃色"
      },
      {
        "id": "t7",
        "num": "07",
        "name": "7組 緑"
      },
      {
        "id": "t8",
        "num": "08",
        "name": "8組 青"
      }
    ],
    "deadline": "2026-10-02T13:35:00+09:00",
    "status": "open",
    "result_order": null,
    "trifecta_odds_default": 50,
    "trifecta_odds_overrides": {}
  },
  {
    "id": "day-ev-11-all",
    "type": "event",
    "event_id": "ev-11",
    "heat_id": "all",
    "category": "field",
    "no": "11",
    "title": "騎馬戦",
    "en": "KIBASEN",
    "options": [
      {
        "id": "red",
        "num": "RED",
        "name": "紅組"
      },
      {
        "id": "white",
        "num": "WHITE",
        "name": "白組"
      }
    ],
    "deadline": "2026-10-02T13:55:00+09:00",
    "status": "open",
    "result_order": null,
    "trifecta_odds_default": 50,
    "trifecta_odds_overrides": {}
  },
  {
    "id": "day-overall",
    "type": "overall",
    "event_id": null,
    "heat_id": null,
    "category": null,
    "no": "*",
    "title": "体育祭 全体優勝",
    "en": "OVERALL WINNER",
    "options": [
      {
        "id": "t1",
        "num": "01",
        "name": "1組 黄色"
      },
      {
        "id": "t2",
        "num": "02",
        "name": "2組 水色"
      },
      {
        "id": "t3",
        "num": "03",
        "name": "3組 白"
      },
      {
        "id": "t4",
        "num": "04",
        "name": "4組 赤"
      },
      {
        "id": "t5",
        "num": "05",
        "name": "5組 橙"
      },
      {
        "id": "t6",
        "num": "06",
        "name": "6組 桃色"
      },
      {
        "id": "t7",
        "num": "07",
        "name": "7組 緑"
      },
      {
        "id": "t8",
        "num": "08",
        "name": "8組 青"
      }
    ],
    "deadline": "2026-10-02T00:10:00.000Z",
    "status": "open",
    "result_order": null,
    "trifecta_odds_default": 50,
    "trifecta_odds_overrides": {}
  }
]$data$::jsonb);
end;
$setup$;
