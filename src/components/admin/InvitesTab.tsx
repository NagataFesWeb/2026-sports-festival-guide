// CSV 取り込みタブ。招集案内と生徒名簿をそれぞれ丸ごと差し替える
import { importInvitesAction, importRosterAction } from "@/app/admin/actions";
import type { InviteEntry, Student } from "@/lib/festival/types";
import { ActionForm } from "./ActionForm";

interface Props {
  invites: InviteEntry[];
  students: Student[];
}

const PREVIEW_ROWS = 10;

export function InvitesTab({ invites, students }: Props) {
  return (
    <section className="grid gap-4">
      <div className="adm-card">
        <h2 className="adm-title">招集案内 CSV</h2>
        <p className="mt-1 text-[12.5px]">
          ヘッダー: <code className="adm-code">学籍番号,種目名,集合時間,場所</code> ＋ 任意で{" "}
          <code className="adm-code">補足</code>（<code className="adm-code">学籍番号,種目名,集合時間,場所,補足</code>）
        </p>
        <p className="adm-note mb-3">
          英語ヘッダー <code className="adm-code">student_id,event_name,gather_time,location,tag</code> も可。列の順序は自由です。
          補足（「ゼッケン着用」「軍手持参」など）はマイページのタグとして出ます。無ければ空欄のままで構いません。
          取り込むと既存の招集案内は全件置き換わります。学籍番号・種目名が空の行はスキップして件数を報告します。
        </p>
        <ActionForm action={importInvitesAction} submitLabel="招集案内を取り込む">
          <div className="grid gap-3">
            <label className="adm-field">
              <span>CSV ファイル</span>
              <input className="adm-input" type="file" name="file" accept=".csv,text/csv" />
            </label>
            <label className="adm-field">
              <span>または内容を貼り付け</span>
              <textarea
                className="adm-input"
                name="csv"
                rows={4}
                placeholder={"学籍番号,種目名,集合時間,場所,補足\n2117,男女混合リレー,11:05,第1トラック 招集所,ゼッケン着用"}
              />
            </label>
          </div>
        </ActionForm>

        <p className="mt-4 text-[12.5px] font-black">現在の登録: {invites.length} 件</p>
        <div className="adm-scroll">
          <table className="adm-table">
            <caption>先頭 {Math.min(PREVIEW_ROWS, invites.length)} 件のプレビュー</caption>
            <thead>
              <tr>
                <th>学籍番号</th>
                <th>種目名</th>
                <th>集合時間</th>
                <th>場所</th>
                <th>補足</th>
              </tr>
            </thead>
            <tbody>
              {invites.slice(0, PREVIEW_ROWS).map((invite) => (
                <tr key={invite.id}>
                  <td className="adm-num">{invite.studentId}</td>
                  <td>{invite.eventName}</td>
                  <td className="adm-num">{invite.gatherTime || "―"}</td>
                  <td>{invite.location || "―"}</td>
                  <td>{invite.tag === "" ? "―" : <span className="adm-chip">{invite.tag}</span>}</td>
                </tr>
              ))}
              {invites.length === 0 && (
                <tr>
                  <td colSpan={5}>招集案内が登録されていません</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="adm-card">
        <h2 className="adm-title">生徒名簿 CSV</h2>
        <p className="mt-1 text-[12.5px]">
          ヘッダー: <code className="adm-code">学籍番号,名前</code> ＋ 任意で{" "}
          <code className="adm-code">学年,組</code>（<code className="adm-code">学籍番号,名前,学年,組</code>）
        </p>
        <p className="adm-note mb-3">
          英語ヘッダー <code className="adm-code">student_id,name,grade,class_no</code> も可。学年は 1〜3、組は 1〜8 で、
          数字以外・範囲外・空欄は「―」になります（マイページの「2年1組」表示に使います）。
          名簿はカジノ口座を作れる学籍番号の一覧と、最終ランキングの氏名表示にも使います。重複した学籍番号は先頭の 1 件だけ残ります。
        </p>
        <ActionForm action={importRosterAction} submitLabel="生徒名簿を取り込む">
          <div className="grid gap-3">
            <label className="adm-field">
              <span>CSV ファイル</span>
              <input className="adm-input" type="file" name="file" accept=".csv,text/csv" />
            </label>
            <label className="adm-field">
              <span>または内容を貼り付け</span>
              <textarea className="adm-input" name="csv" rows={4} placeholder={"学籍番号,名前,学年,組\n2117,サンプル生徒04,2,1"} />
            </label>
          </div>
        </ActionForm>

        <p className="mt-4 text-[12.5px] font-black">現在の登録: {students.length} 件</p>
        <div className="adm-scroll">
          <table className="adm-table">
            <caption>先頭 {Math.min(PREVIEW_ROWS, students.length)} 件のプレビュー</caption>
            <thead>
              <tr>
                <th>学籍番号</th>
                <th>名前</th>
                <th>学年</th>
                <th>組</th>
              </tr>
            </thead>
            <tbody>
              {students.slice(0, PREVIEW_ROWS).map((student) => (
                <tr key={student.studentId}>
                  <td className="adm-num">{student.studentId}</td>
                  <td>{student.name}</td>
                  <td className="adm-num">{student.grade === null ? "―" : `${student.grade}年`}</td>
                  <td className="adm-num">{student.classNo === null ? "―" : `${student.classNo}組`}</td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={4}>生徒名簿が登録されていません</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
