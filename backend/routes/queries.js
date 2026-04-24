const express=require('express'),pool=require('../models/db'),auth=require('../middleware/auth'),r=express.Router();
r.get('/',auth,async(q,s)=>{try{s.json((await pool.query('SELECT ql.*,md.name as db_name FROM query_logs ql LEFT JOIN monitored_databases md ON ql.database_id=md.id ORDER BY ql.execution_time_ms DESC LIMIT 200')).rows)}catch(e){s.status(500).json({error:e.message})}});
r.get('/:id',auth,async(q,s)=>{try{const r=await pool.query('SELECT ql.*,md.name as db_name FROM query_logs ql LEFT JOIN monitored_databases md ON ql.database_id=md.id WHERE ql.id=$1',[q.params.id]);r.rows.length?s.json(r.rows[0]):s.status(404).json({error:'Not found'})}catch(e){s.status(500).json({error:e.message})}});
module.exports=r;
