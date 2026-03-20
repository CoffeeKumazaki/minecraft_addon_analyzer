Minecraft Bedrock Add-on 解析Webアプリ 仕様書

版: v0.1
作成日: 2026-03-20
目的: ダウンロードした Minecraft Bedrock Add-on（.mcaddon, .mcpack, .zip）を読み込み、追加されるアイテム / ブロック / モブ / レシピ / 挙動を解析・可視化し、人間が理解しやすい仕様書形式で要約する。

1. 背景と目的

Minecraft Bedrock Add-on は ZIP ベースの構成を持ち、Behavior Pack / Resource Pack / Script API を含むことで、ゲーム内に様々なコンテンツや挙動を追加できる。

しかし既存のツールの多くは以下に偏っている。

開発者向けの編集支援

JSON / schema のバリデーション

ファイルツリー表示

IDE 補完

一方で、ユーザーが本当に知りたいのは以下である。

この Add-on は何を追加するのか

どんなアイテム / ブロック / モブ / レシピがあるのか

それらはどう振る舞うのか

見た目変更だけなのか、ゲームプレイも変えるのか

Script を使っているか

依存関係や危険な上書きがあるか

本アプリは、Add-on を検証するツールではなく、
Add-on の中身を逆解析して仕様書化するインスペクタとして設計する。

2. 目標
2.1 主目標

ユーザーが Add-on ファイルをアップロードすると、以下を数秒以内に把握できる状態を作る。

何が追加されるか

何が変更されるか

どの程度複雑か

どの程度安全に導入できそうか

2.2 MVP の成功条件

MVP では以下を満たせば成功とする。

.mcaddon, .mcpack, .zip を読み込める

Behavior Pack / Resource Pack を判別できる

以下を一覧表示できる

アイテム

ブロック

モブ

レシピ

entity / item / block の主要な挙動をタグ化できる

自然言語で Add-on の概要を要約できる

参照切れや不足ファイルを警告できる

3. 対象範囲
3.1 対象

Minecraft Bedrock Edition Add-on

入力形式

.mcaddon

.mcpack

.zip

非暗号化の Add-on

ローカルで取得済みの Add-on ファイル

3.2 非対象

MVP では以下は対象外とする。

Java Edition mod (.jar, Forge, Fabric)

Marketplace の特殊パッケージや暗号化済みコンテンツ

完全なゲーム挙動再現

Script API の完全動的解析

他 Add-on との競合を完全にシミュレーションすること

ワールドデータやセーブデータの解析

リアルタイム実行環境での検証

4. 想定ユーザー
4.1 一般ユーザー

ダウンロードした Add-on の内容を知りたい

危険そうな変更や複雑さを知りたい

4.2 教材開発者 / 教育者

教材として使う前に内容を把握したい

追加要素やレシピを一覧化したい

4.3 Add-on 開発者

他人の Add-on 構造を調査したい

仕様整理やリファレンス化をしたい

5. ユースケース
UC-01: Add-on 内容確認

ユーザーが .mcaddon をアップロードし、追加アイテム・追加モブ・レシピ一覧を確認する。

UC-02: 教材向け分析

ユーザーが Add-on を読み込ませて、「追加されるもの」と「学習に使えそうな機能」を把握する。

UC-03: 開発参考調査

ユーザーが既存 Add-on を解析し、entity / animation / loot / recipe の設計を調べる。

UC-04: 危険箇所確認

ユーザーが導入前に、Script API 使用有無、依存パック、不足ファイル、参照切れを確認する。

6. 提供価値

本アプリの価値は、単なる JSON 表示ではなく以下にある。

追加要素の一覧化

ルールベースの挙動要約

参照関係の可視化

自然言語による仕様説明

不確実性の明示

7. 機能要件
7.1 ファイル入力
必須

ユーザーは以下の方法で Add-on を読み込める

ドラッグ＆ドロップ

ファイル選択ダイアログ

複数ファイル対応は MVP では不要

1 回の解析対象は 1 Add-on

入力形式判定

.mcaddon: 複数 pack を内包する可能性あり

.mcpack: 単一 pack 想定

.zip: 汎用 ZIP として解析

受け入れ条件

ZIP 展開可能であること

manifest.json または Bedrock Pack 構造を推定できること

7.2 パック構造解析
必須

以下を判定する。

Behavior Pack の有無

Resource Pack の有無

Script API の有無

複数 pack の内包有無

パック名

UUID

version

min_engine_version

dependency

出力例

Pack Type: Behavior + Resource

Script: あり

Dependencies: 2件

Engine Version: 1.21.x 以上

7.3 追加コンテンツ解析
必須カテゴリ

以下を検出・列挙する。

Items

Blocks

Entities / Mobs

Recipes

Loot Tables

Spawn Rules

Trading

Functions

Animations

Animation Controllers

Geometries

Textures

Sounds

Scripts

各カテゴリの最低出力
Items

identifier

表示名候補

icon 参照

主要コンポーネント

挙動タグ

Blocks

identifier

material / texture 参照

collision / destroy time など主要設定

挙動タグ

Entities

identifier

spawn egg 有無

family

health

movement

attack 関連

tame / breed など

AI 関連タグ

event / component_group の概要

テクスチャ / geometry / animation 参照

Recipes

recipe type

input

output

furnace / shapeless / shaped など種別

7.4 挙動タグ化
目的

複雑な JSON を、人間が読めるラベルへ変換する。

必須タグ例
Entity 向け

敵対的

中立

友好的

テイム可能

繁殖可能

ライド可能

飛行

水中行動

遠距離攻撃

近接攻撃

成長段階あり

変身 / 形態変化

イベント駆動

スポーン条件あり

ルートテーブルあり

Script 連携あり

Item 向け

設置可能

食べられる

装備可能

武器

道具

オフハンド可

ブロック配置系

使用時効果あり

耐久値あり

Script 連携あり

Block 向け

破壊可能

透明

当たり判定あり

発光

方向性あり

状態変化あり

インタラクト可能

レッドストーン関連

Script 連携あり

要件

タグ付けはルールベース

JSON 内コンポーネントやイベント参照に基づいて付与

根拠となるキーを内部保持する

7.5 参照関係解析
必須

以下の参照を解析する。

item → icon / texture

block → texture / geometry

entity → texture / geometry / animation / animation controller / render controller

recipe → input / output item

spawn rule → entity

loot table → item / block / entity 関連

script → event / command / API 利用痕跡

出力

関連リソース一覧

参照切れ警告

BP と RP の対応関係

7.6 自然言語サマリー生成
必須

アプリは Add-on 全体について短い概要文を生成する。

例

「この Add-on は主に新しい食べ物とクラフトレシピを追加します。モブ追加はなく、ゲームプレイ変更は軽度です。」

「この Add-on は複数の新規モブを追加し、それぞれにカスタム AI とドロップテーブルがあります。Resource Pack 依存が強く、見た目と挙動の両方を変更します。」

「この Add-on は Script API を使ってイベント処理を行っており、JSON だけでは全体挙動を完全には把握できません。」

条件

サマリーはルールベース + テンプレート生成で構わない

LLM は将来拡張として任意

MVP では deterministic に近い説明生成を優先

7.7 警告・診断
必須

以下を検出する。

manifest 不足

pack metadata 不足

identifier 重複

参照切れ

texture / geometry / animation の欠落

dependency 不足

Script API 使用

functions の存在

非対応フォーマット

解析不能 JSON

警告レベル

Error: 解析継続が困難

Warning: 一部情報が欠落または不正

Info: 注意事項や補足

7.8 検索・絞り込み
MVP 必須

名前検索

カテゴリ絞り込み

タグ絞り込み

例

「敵対的なモブだけ見る」

「食べられるアイテムだけ見る」

「レシピがあるアイテムだけ見る」

7.9 エクスポート
MVP 必須

Markdown 出力

JSON 出力

将来拡張

PDF

CSV

Notion / Docs 形式

8. 非機能要件
8.1 パフォーマンス

一般的な Add-on で 3 秒以内に初期結果表示

大きめの Add-on でも 10 秒以内に主要情報表示

UI は段階的レンダリング対応

まず概要

次にカテゴリ一覧

次に詳細

8.2 セキュリティ

ファイルは原則クライアント側で解析する

外部送信しない設計を基本とする

必要に応じて「ローカル解析です」と明示

ZIP 展開時は path traversal 対策を行う

スクリプトは実行しない

HTML / JS はレンダリングせずテキストとして扱う

8.3 可用性

ブラウザのみで利用可能

アカウント不要で利用可能

8.4 保守性

各カテゴリ解析器はプラグイン化する

Minecraft バージョン差異に耐えられる構造にする

schema / mapping 辞書を差し替え可能にする

9. 画面仕様
9.1 画面一覧

トップ画面

解析結果サマリー画面

詳細一覧画面

個別詳細画面

警告一覧画面

エクスポート画面

9.2 トップ画面
要素

タイトル

説明文

ファイルドロップ領域

対応形式表示

サンプル Add-on で試すボタン（任意）

主メッセージ

Add-on をアップロードしてください

.mcaddon, .mcpack, .zip に対応

9.3 解析結果サマリー画面
表示内容

Add-on 名

Pack 構成

Script 有無

追加要素数

アイテム数

ブロック数

モブ数

レシピ数

主な特徴タグ

概要説明

警告件数

例

アイテム: 12

ブロック: 4

モブ: 3

レシピ: 8

特徴: 料理系 敵対モブ追加 Scriptあり

9.4 詳細一覧画面
タブ

Overview

Items

Blocks

Entities

Recipes

Loot

Spawn Rules

Scripts

Assets

Warnings

共通機能

検索バー

タグ絞り込み

ソート

件数表示

9.5 個別詳細画面
Entity 詳細例

identifier

概要

主要ステータス

挙動タグ

component 一覧

event / component_group 概要

参照アセット

関連 spawn rule

関連 loot table

警告

Recipe 詳細例

recipe type

pattern / ingredients

result

関連アイテムリンク

10. システム構成
10.1 推奨構成
フロントエンド

Next.js or React

TypeScript

ZIP 展開ライブラリ使用

ローカル解析主体

バックエンド

MVP では不要でもよい。
必要なら以下用途で軽量 API を置く。

大型ファイルのサーバ解析

レポート保存

将来的な共有 URL 発行

LLM サマリー生成

理想

まずはフロントエンド単独構成で作る。
理由は、アップロードファイルのプライバシー懸念を減らせるから。

11. 解析パイプライン
11.1 処理フロー

ファイル受け取り

ZIP 判定

展開

pack 検出

manifest 解析

ファイルインデックス作成

カテゴリ別解析

参照解決

挙動タグ生成

サマリー生成

UI 表示

エクスポート可能化

11.2 内部処理詳細
Step 1: 展開

.mcaddon, .mcpack, .zip を ZIP として展開

ファイル一覧作成

Step 2: Pack 検出

manifest.json を探索

複数 pack を判定

モジュール情報から pack type を推定

Step 3: 正規化

パス区切り統一

JSON 解析

一部壊れた JSON でも可能な範囲で継続

Step 4: カテゴリ分類

以下ディレクトリや構造をベースに分類。

items/

blocks/

entities/

recipes/

loot_tables/

spawn_rules/

trading/

functions/

textures/

animations/

animation_controllers/

models/

scripts/

Step 5: 参照解決

identifier / path / resource key を使って関連付け

Step 6: タグ推定

ルール辞書ベースで挙動ラベル付け

Step 7: サマリー生成

構造化結果をテンプレートに流し込む

12. 内部データモデル

以下は内部 IR の例。
実装はこの構造を中心にすると後で拡張しやすい。

type AnalysisResult = {
  addon: AddonSummary;
  packs: PackInfo[];
  items: ItemSpec[];
  blocks: BlockSpec[];
  entities: EntitySpec[];
  recipes: RecipeSpec[];
  lootTables: LootTableSpec[];
  spawnRules: SpawnRuleSpec[];
  trades: TradeSpec[];
  scripts: ScriptSpec[];
  assets: AssetSpec[];
  warnings: Diagnostic[];
  summary: SummarySpec;
};

type AddonSummary = {
  name: string;
  description?: string;
  packTypes: ("behavior" | "resource" | "script")[];
  versions: string[];
  minEngineVersion?: string;
  dependencies: DependencySpec[];
};

type PackInfo = {
  name: string;
  type: "behavior" | "resource" | "mixed" | "unknown";
  path: string;
  uuid?: string;
  version?: string;
  modules: PackModule[];
};

type ItemSpec = {
  id: string;
  title?: string;
  sourcePath: string;
  icon?: string;
  tags: string[];
  components: Record<string, unknown>;
  references: ReferenceLink[];
  diagnostics: Diagnostic[];
};

type BlockSpec = {
  id: string;
  sourcePath: string;
  tags: string[];
  textures: string[];
  states?: string[];
  components: Record<string, unknown>;
  references: ReferenceLink[];
  diagnostics: Diagnostic[];
};

type EntitySpec = {
  id: string;
  sourcePath: string;
  family?: string[];
  tags: string[];
  health?: number;
  movement?: number;
  behaviors: string[];
  events: string[];
  componentGroups: string[];
  textures: string[];
  geometries: string[];
  animations: string[];
  lootTables: string[];
  spawnRules: string[];
  references: ReferenceLink[];
  diagnostics: Diagnostic[];
};

type RecipeSpec = {
  id?: string;
  recipeType: string;
  sourcePath: string;
  inputs: RecipeIO[];
  outputs: RecipeIO[];
  tags: string[];
  diagnostics: Diagnostic[];
};

type ScriptSpec = {
  sourcePath: string;
  imports: string[];
  apiHints: string[];
  events: string[];
  commands: string[];
  diagnostics: Diagnostic[];
};

type ReferenceLink = {
  kind: string;
  target: string;
  resolved: boolean;
};

type Diagnostic = {
  level: "error" | "warning" | "info";
  code: string;
  message: string;
  path?: string;
};

type SummarySpec = {
  shortDescription: string;
  contentFocus: string[];
  gameplayImpact: "low" | "medium" | "high" | "unknown";
  scriptUsage: boolean;
};
13. API 仕様

MVP がフロント単体なら内部関数でもよい。
API 化する場合の仕様を定義する。

13.1 POST /api/analyze
入力

multipart/form-data

file

出力

AnalysisResult

エラー

unsupported_format

unzip_failed

manifest_not_found

parse_error

13.2 POST /api/export/markdown
入力

AnalysisResult

出力

Markdown テキスト

13.3 POST /api/export/json
入力

AnalysisResult

出力

整形済み JSON

14. 挙動推定ルール

ここは実装の心臓部。
曖昧にするとゴミになる。

14.1 ルール設計方針

完全な意味理解は狙わない

キーと component の存在から保守的に判定する

過剰解釈しない

「不明」を許容する

根拠を内部保持する

14.2 例
Entity

melee attack 系 component があれば 近接攻撃

ranged attack 系があれば 遠距離攻撃

tameable があれば テイム可能

breedable があれば 繁殖可能

rideable があれば ライド可能

navigation.fly / flying 系なら 飛行

event が多ければ イベント駆動

loot table 参照があれば ドロップあり

spawn_rules 参照があれば スポーン条件あり

Item

food component → 食べられる

durability component → 耐久値あり

wearable component → 装備可能

block placer 系 → 設置可能

shooter / projectile 系 → 射出系

use modifiers / cooldown → 使用時効果あり

Block

light emission → 発光

states 定義 → 状態変化あり

geometry 指定 → 特殊形状

interact 系 component → インタラクト可能

15. エクスポート仕様
15.1 Markdown

以下を含む。

タイトル

概要

Pack 情報

追加要素サマリー

Items 一覧

Blocks 一覧

Entities 一覧

Recipes 一覧

Warnings

Script 補足

15.2 JSON

内部 IR をそのまま、または少し整形して出力

16. エラーハンドリング
16.1 方針

可能な限り解析継続

一部壊れていても全体結果を返す

致命的失敗以外は warnings に落とす

16.2 例

JSON 1ファイルだけ壊れている
→ 他は継続、該当要素のみ warning

texture 参照切れ
→ 該当 resource 未解決として warning

manifest 不在
→ pack 推定を試みるが、困難なら error

17. テスト要件
17.1 正常系

単一 .mcpack

複数 pack 含む .mcaddon

Resource Pack のみ

Behavior Pack のみ

Script 含む Add-on

17.2 異常系

壊れた ZIP

manifest 不在

JSON 構文エラー

参照切れ

未知のフォルダ構成

非対応形式

17.3 品質観点

解析速度

warning 妥当性

タグ精度

誤判定率

サマリー説明の一貫性

18. MVP 実装優先順位
Phase 1

ファイル読み込み

ZIP 展開

manifest 解析

pack 判定

Items / Blocks / Entities / Recipes の抽出

一覧表示

JSON 出力

Phase 2

挙動タグ化

参照解決

警告表示

Markdown 出力

自然言語サマリー

Phase 3

Loot / Spawn Rules / Trading / Functions 対応

Script API ヒント抽出

詳細画面改善

検索・絞り込み強化

Phase 4

グラフ可視化

Add-on 同士比較

共有 URL

LLM による詳細解説

ワールド内影響の高度推定

19. 将来拡張

Add-on 比較機能

似た Add-on 検索

「教育向け」「建築向け」「戦闘向け」などの分類

recipe / item / entity の依存グラフ

Script の静的 AST 解析

「この Add-on は何系か」の高精度ラベリング

複数 Add-on 一括解析

日本語 / 英語切り替え

Add-on 自動ドキュメント生成

20. リスクと制約
20.1 技術的制約

Script API は静的解析だけでは限界がある

Bedrock のバージョン差分で JSON 構造が変わる可能性がある

配布 Add-on は構成が雑なことがある

Resource 参照は慣例ベースで壊れていることがある

20.2 プロダクト上の注意

「完全理解できる」と見せると嘘になる

正しくは「かなりの範囲まで構造的に把握できる」

不確実性を UI に明示すべき

21. 受け入れ基準

以下を満たしたら v0.1 完了とする。

.mcaddon, .mcpack, .zip をアップロードできる

Pack 構成と manifest 情報を表示できる

アイテム / ブロック / モブ / レシピ一覧を表示できる

各要素に基本タグを付与できる

参照切れ警告を出せる

Add-on 全体の短い自然言語サマリーを出せる

Markdown / JSON で出力できる

22. 実装上の重要判断

これは仕様書の中でも特に重要。

判断1

最初から LLM 依存にしない。
理由は、解析の再現性が落ちるから。

判断2

まずは静的解析で勝つ。
ユーザーが欲しいのは、派手な要約より、まず確実な一覧。

判断3

「追加物」と「挙動」を分けて見せる。
ここをごちゃ混ぜにすると UI が崩壊する。

判断4

Script は“完全解析”ではなく“痕跡抽出”として扱う。
無理に分かったふりをしない。

23. 一言でいうこのアプリの定義

Minecraft Bedrock Add-on を読み込み、
中に含まれる追加要素・参照関係・主要挙動を解析して、
人間向けの仕様書として可視化する Add-on Reverse Inspector。