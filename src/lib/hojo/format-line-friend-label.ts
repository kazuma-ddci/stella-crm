/**
 * 補助金プロジェクトの公式LINE友達を Select オプションのラベル等で表示する際の整形関数。
 * 形式: `{id} {snsname}({sei} {mei})`
 *
 * 姓・名が両方空のときに `( )` という空の括弧が出ないように、姓名がない場合は
 * 括弧自体を省略する。
 */
export function formatLineFriendLabel(f: {
  id: number | bigint;
  snsname: string | null;
  sei: string | null;
  mei: string | null;
}): string {
  const sei = f.sei?.trim() ?? "";
  const mei = f.mei?.trim() ?? "";
  let namePart = "";
  if (sei && mei) namePart = `(${sei} ${mei})`;
  else if (sei) namePart = `(${sei})`;
  else if (mei) namePart = `(${mei})`;
  return `${f.id} ${f.snsname || ""}${namePart}`.trim();
}
