const express=require('express'),pool=require('../models/db'),auth=require('../middleware/auth'),r=express.Router();
r.get('/',auth,async(q,s)=>{try{s.json((await pool.query('SELECT b.*,md.name as db_name FROM backups b LEFT JOIN monitored_databases md ON b.database_id=md.id ORDER BY b.started_at DESC')).rows)}catch(e){s.status(500).json({error:e.message})}});
r.post('/',auth,async(q,s)=>{try{const{database_id,backup_type}=q.body;const r=await pool.query('INSERT INTO backups(database_id,backup_type,status) VALUES($1,$2,$3) RETURNING *',[database_id,backup_type||'full','in_progress']);s.status(201).json(r.rows[0])}catch(e){s.status(500).json({error:e.message})}});
r.delete('/:id',auth,async(q,s)=>{try{await pool.query('DELETE FROM backups WHERE id=$1',[q.params.id]);s.json({message:'Deleted'})}catch(e){s.status(500).json({error:e.message})}});
module.exports=r;
