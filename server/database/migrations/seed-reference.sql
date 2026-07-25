-- TrackCOOP reference data only.
-- Run manually after importing TrackCOOP_Table_Reference_Only.sql.
-- This file is idempotent and does not create user accounts or credentials.

INSERT INTO roles (role_name, role_slug, description, is_active)
VALUES
    ('Chairman', 'chairman', 'Cooperative oversight and administration role.', 1),
    ('Bookkeeper', 'bookkeeper', 'Financial operations and recordkeeping role.', 1),
    ('Member', 'member', 'Cooperative member self-service role.', 1)
ON DUPLICATE KEY UPDATE
    role_name = VALUES(role_name),
    description = VALUES(description),
    is_active = VALUES(is_active);

INSERT INTO financial_categories (
    category_code,
    category_name,
    category_type,
    description,
    is_system_category,
    is_active
)
VALUES
    ('ASSOCIATE_MEMBERSHIP_FEE', 'Associate Membership Fee', 'Income', 'Associate membership fee collections.', 1, 1),
    ('SHARE_CAPITAL', 'Share Capital', 'Income', 'Validated member share-capital contributions.', 1, 1),
    ('RENTAL_INCOME', 'Rental Income', 'Income', 'Income from cooperative asset rentals.', 1, 1),
    ('POS_SALES', 'POS Sales', 'Income', 'Income from point-of-sale transactions.', 1, 1),
    ('DOCUMENT_FEES', 'Document Fees', 'Income', 'Fees collected for eligible cooperative documents.', 1, 1),
    ('SUPPLIES', 'Supplies', 'Expense', 'Operating and office supply expenses.', 1, 1),
    ('UTILITIES', 'Utilities', 'Expense', 'Utility and communication expenses.', 1, 1),
    ('ADJUSTMENTS', 'Adjustments', 'Both', 'Controlled income or expense adjustments.', 1, 1)
ON DUPLICATE KEY UPDATE
    category_name = VALUES(category_name),
    category_type = VALUES(category_type),
    description = VALUES(description),
    is_system_category = VALUES(is_system_category),
    is_active = VALUES(is_active);

INSERT INTO system_settings (
    setting_group,
    setting_key,
    setting_value,
    value_type,
    description,
    is_public
)
VALUES
    ('membership', 'associate_membership_fee', '200.00', 'Number', 'Associate membership fee in Philippine pesos.', 0),
    ('membership', 'true_member_share_capital_requirement', '3000.00', 'Number', 'Share-capital requirement for true-member status in Philippine pesos.', 0),
    ('membership', 'initial_share_capital_payment', '1500.00', 'Number', 'Initial true-member share-capital payment in Philippine pesos.', 0),
    ('membership', 'share_capital_completion_months', '12', 'Number', 'Number of months allowed to complete the true-member share-capital requirement.', 0),
    ('membership', 'maximum_share_capital', '15000.00', 'Number', 'Maximum validated member share capital in Philippine pesos.', 0),
    ('membership', 'member_indicator_labels', '["Active","Needs Monitoring","Inactive"]', 'JSON', 'Display labels for calculated member indicators; indicators do not change official member status.', 0)
ON DUPLICATE KEY UPDATE
    setting_group = VALUES(setting_group),
    setting_value = VALUES(setting_value),
    value_type = VALUES(value_type),
    description = VALUES(description),
    is_public = VALUES(is_public);
