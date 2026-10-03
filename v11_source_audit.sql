-- V24 verification
select column_name,data_type
from information_schema.columns
where table_schema='public' and table_name='planned_items'
order by ordinal_position;

select flow_type,count_as_income,count(*) as rows,sum(coalesce(income_amount,0)) as income_amount
from public.transactions
where source='עו״ש' and coalesce(bank_credit,0)>0
group by flow_type,count_as_income
order by flow_type;

select month,
       round(sum(amount) filter (where count_as_expense=true),2) as expenses,
       round(sum(coalesce(income_amount,amount)) filter (where count_as_income=true),2) as income
from public.transactions
group by month
order by month desc
limit 12;
