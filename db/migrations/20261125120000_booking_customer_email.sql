-- migrate:up
-- The email given for this booking. Customers are matched by phone, and the customer record keeps
-- the first email ever given for that number, so a booking's own emails (confirmation, reminder,
-- refund, changes) go to the address typed for that booking instead. Not copied back to the
-- customer record: anyone can type any phone number, and that mustn't redirect another person's
-- emails. Existing bookings take their customer's email, which is where they were sent until now.
alter table bookings add column customer_email text;
update bookings b set customer_email = c.email from customers c where c.id = b.customer_id and c.email is not null;

-- migrate:down
alter table bookings drop column customer_email;
