import test from 'node:test';
import assert from 'node:assert/strict';
import { supersededSql } from './financial-posting-rules';

test('superseded lookup keeps correction and reversal checks independent and alias-safe', () => {
  const sql = supersededSql('entry');
  assert.equal((sql.match(/EXISTS\(SELECT 1 FROM financial_records child/g) ?? []).length, 2);
  assert.match(sql, /child\.correction_of_record_id=entry\.financial_record_id/);
  assert.match(sql, /child\.reversal_of_record_id=entry\.financial_record_id/);
  assert.equal((sql.match(/child\.record_status='Active' AND child\.approved_by IS NOT NULL/g) ?? []).length, 2);
  assert.match(sql, /entry\.reversal_of_record_id IS NOT NULL/);
});
