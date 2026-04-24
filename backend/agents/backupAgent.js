const pool = require('../models/db');
class backupAgent {
  constructor(){this.name='backupAgent';}
  async log(dbId,action,status,message,ms){await pool.query('INSERT INTO db_logs(database_id,agent,action,status,message,duration_ms) VALUES($1,$2,$3,$4,$5,$6)',[dbId,this.name,action,status,message,ms]);}
  async execute(db){const s=Date.now();try{await this.log(db.id,'execute','info','Started',0);const d=Date.now()-s;await this.log(db.id,'complete','success','Completed',d);return{success:true,duration:d};}catch(e){await this.log(db.id,'error','error',e.message,Date.now()-s);return{success:false,error:e.message};}}
}
module.exports=new backupAgent();
