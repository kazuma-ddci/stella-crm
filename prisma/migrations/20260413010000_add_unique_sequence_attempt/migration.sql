-- 並行性対応: (slpMemberId, sequence) の組み合わせを一意に
-- 万一sequence計算で競合しても、DB側の一意制約で検知・エラー化できる

CREATE UNIQUE INDEX "slp_contract_attempts_slp_member_id_sequence_key"
  ON "slp_contract_attempts"("slp_member_id", "sequence");
