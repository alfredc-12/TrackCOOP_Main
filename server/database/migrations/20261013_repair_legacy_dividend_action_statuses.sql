-- Repair requests that were written as an empty ENUM value before the action
-- approval state was added. Only unprocessed rows with matching action history
-- are repaired while completed dividend records are left untouched.

UPDATE member_dividends dividend
JOIN dividend_action_history history
  ON history.member_dividend_id = dividend.member_dividend_id
 AND history.new_status IN ('Withdrawal Requested', 'Capitalization Requested')
SET dividend.dividend_status = history.new_status
WHERE dividend.dividend_status = ''
  AND dividend.processed_at IS NULL
  AND dividend.member_decision IN ('Withdraw', 'Add to Share Capital');
