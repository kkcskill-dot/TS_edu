-- Educational text map; SQL_ID values correspond to the supplied snapshot, not a fresh parse.
-- Family FMS 771122330099 is deliberately split across three literal variants.
SELECT order_id, status FROM orders WHERE tenant_id = 101 AND order_id = :order_id; -- 1it3ra1000001
SELECT order_id, status FROM orders WHERE tenant_id = 202 AND order_id = :order_id; -- 1it3ra1000002
SELECT order_id, status FROM orders WHERE tenant_id = 303 AND order_id = :order_id; -- 1it3ra1000003

MERGE INTO settlement_target t
USING (SELECT s.order_id, s.amount, d.rate FROM settlement_stage s JOIN tenant_dim d ON d.tenant_id=s.tenant_id
       WHERE s.batch_id=:batch_id) x
ON (t.order_id=x.order_id)
WHEN MATCHED THEN UPDATE SET t.amount=x.amount*x.rate, t.updated_at=SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT(order_id,amount,updated_at) VALUES(x.order_id,x.amount*x.rate,SYSTIMESTAMP); -- 9u1m3rg3a0b1x
