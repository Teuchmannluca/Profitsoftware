-- Enable Row Level Security on all tables.
-- This is a single-tenant app — authenticated users get full access.
-- The service role key (used by cron/sync) bypasses RLS automatically.

-- Orders & items
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_orders" ON orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_orders" ON orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_order_items" ON order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_order_items" ON order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_products" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_products" ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Business settings
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_settings" ON business_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_settings" ON business_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- COGS
ALTER TABLE cogs_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_cogs" ON cogs_periods FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_cogs" ON cogs_periods FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Expenses
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_expenses" ON expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_expenses" ON expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Returns
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_returns" ON returns FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_returns" ON returns FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Reimbursements
ALTER TABLE reimbursements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_reimbursements" ON reimbursements FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_reimbursements" ON reimbursements FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Inbound shipments
ALTER TABLE inbound_shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_inbound" ON inbound_shipments FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_inbound" ON inbound_shipments FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE inbound_shipment_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_inbound_items" ON inbound_shipment_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_inbound_items" ON inbound_shipment_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Ad spend
ALTER TABLE ad_spend_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_ad_spend" ON ad_spend_daily FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_ad_spend" ON ad_spend_daily FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE ad_product_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_ad_product" ON ad_product_daily FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_ad_product" ON ad_product_daily FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE ad_targeting_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_ad_targeting" ON ad_targeting_daily FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_ad_targeting" ON ad_targeting_daily FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Notifications
ALTER TABLE notification_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_notif_profiles" ON notification_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_notif_profiles" ON notification_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_notif_log" ON notification_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_notif_log" ON notification_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Sync log
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_sync_log" ON sync_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_sync_log" ON sync_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
