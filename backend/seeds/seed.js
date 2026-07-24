const { Pool } = require('pg'); const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '../../.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_database_admin_db' });
function requireDemoPassword() {
  const password = process.env.DEMO_PASSWORD || process.env.SEED_DEMO_PASSWORD || process.env.DEMO_SEED_PASSWORD || '';
  if (password.length < 12 || password.length > 1024) throw new Error('DEMO_PASSWORD must contain 12-1024 characters');
  return password;
}

async function seed() {
  try {
    await pool.query('DELETE FROM db_logs'); await pool.query('DELETE FROM backups'); await pool.query('DELETE FROM suggested_indexes'); await pool.query('DELETE FROM query_logs'); await pool.query('DELETE FROM monitored_databases'); await pool.query('DELETE FROM users');
    const h = await bcrypt.hash(requireDemoPassword(), 10);
    const u = await pool.query("INSERT INTO users (email,password,name) VALUES ('admin@example.com',$1,'Admin User') RETURNING id",[h]);
    const uid = u.rows[0].id;
    const dbs = [
      {name:'Production MySQL',host:'db-prod-01.aws.com',port:3306,db:'ecommerce_prod',type:'MySQL',status:'healthy',size:45600,queries:892340,slow:234,uptime:8760},
      {name:'Analytics PostgreSQL',host:'analytics-01.gcp.com',port:5432,db:'analytics_dw',type:'PostgreSQL',status:'healthy',size:128000,queries:1234567,slow:89,uptime:4380},
      {name:'User MongoDB',host:'mongo-cluster.aws.com',port:27017,db:'users_db',type:'MongoDB',status:'warning',size:23400,queries:5678900,slow:567,uptime:2190},
      {name:'Cache Redis',host:'redis-01.aws.com',port:6379,db:'cache_0',type:'Redis',status:'healthy',size:8200,queries:45000000,slow:12,uptime:8760},
      {name:'Search Elasticsearch',host:'es-cluster.aws.com',port:9200,db:'products_index',type:'Elasticsearch',status:'healthy',size:67800,queries:3456789,slow:145,uptime:6570},
      {name:'Staging PostgreSQL',host:'db-staging.aws.com',port:5432,db:'app_staging',type:'PostgreSQL',status:'healthy',size:12300,queries:234567,slow:45,uptime:720},
      {name:'Logs TimescaleDB',host:'timescale-01.aws.com',port:5432,db:'logs_ts',type:'TimescaleDB',status:'critical',size:890000,queries:78901234,slow:2340,uptime:8760},
      {name:'Auth DynamoDB',host:'dynamodb.us-east-1.aws.com',port:443,db:'auth_table',type:'DynamoDB',status:'healthy',size:5600,queries:12345678,slow:23,uptime:8760},
      {name:'Reports MySQL',host:'db-reports.aws.com',port:3306,db:'reports_db',type:'MySQL',status:'warning',size:34500,queries:456789,slow:678,uptime:4380},
      {name:'Inventory PostgreSQL',host:'db-inv-01.aws.com',port:5432,db:'inventory',type:'PostgreSQL',status:'healthy',size:18900,queries:789012,slow:56,uptime:2190},
      {name:'Payment Cassandra',host:'cassandra-01.aws.com',port:9042,db:'payments_ks',type:'Cassandra',status:'healthy',size:56700,queries:2345678,slow:89,uptime:8760},
      {name:'ML Features PostgreSQL',host:'ml-db-01.gcp.com',port:5432,db:'feature_store',type:'PostgreSQL',status:'healthy',size:234000,queries:1234567,slow:345,uptime:6570},
      {name:'CMS MariaDB',host:'cms-db.aws.com',port:3306,db:'wordpress_prod',type:'MariaDB',status:'warning',size:8900,queries:345678,slow:456,uptime:4380},
      {name:'Graph Neo4j',host:'neo4j-01.aws.com',port:7687,db:'social_graph',type:'Neo4j',status:'healthy',size:45600,queries:567890,slow:34,uptime:2190},
      {name:'Queue RabbitMQ',host:'rabbit-01.aws.com',port:5672,db:'message_queue',type:'RabbitMQ',status:'healthy',size:2300,queries:89012345,slow:5,uptime:8760},
      {name:'Dev PostgreSQL',host:'localhost',port:5432,db:'dev_local',type:'PostgreSQL',status:'healthy',size:4500,queries:123456,slow:12,uptime:720},
      {name:'Test MySQL',host:'db-test.aws.com',port:3306,db:'test_db',type:'MySQL',status:'healthy',size:6700,queries:234567,slow:23,uptime:720},
      {name:'Archive S3 Parquet',host:'s3.us-east-1.aws.com',port:443,db:'data-archive-bucket',type:'S3/Parquet',status:'healthy',size:2340000,queries:45678,slow:0,uptime:8760}
    ];
    const queryTypes = ['SELECT','INSERT','UPDATE','DELETE','JOIN'];
    const tables = ['users','orders','products','payments','sessions','logs','events','inventory'];
    for (const d of dbs) {
      const dr = await pool.query('INSERT INTO monitored_databases (name,host,port,db_name,db_type,status,size_mb,total_queries,slow_queries,uptime_hours,last_check,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),$11) RETURNING id',
        [d.name,d.host,d.port,d.db,d.type,d.status,d.size,d.queries,d.slow,d.uptime,uid]);
      const did = dr.rows[0].id;
      for (let i=0;i<3;i++) {
        const qt = queryTypes[Math.floor(Math.random()*queryTypes.length)];
        const tbl = tables[Math.floor(Math.random()*tables.length)];
        await pool.query('INSERT INTO query_logs (database_id,query_text,execution_time_ms,status,table_name,query_type) VALUES ($1,$2,$3,$4,$5,$6)',
          [did,`${qt} * FROM ${tbl} WHERE id > ${Math.floor(Math.random()*1000)}`,Math.floor(Math.random()*5000)+100,'completed',tbl,qt]);
      }
      await pool.query('INSERT INTO suggested_indexes (database_id,table_name,column_name,index_type,impact_score,status) VALUES ($1,$2,$3,$4,$5,$6)',
        [did,tables[Math.floor(Math.random()*tables.length)],'created_at','btree',Math.floor(Math.random()*100),'suggested']);
      await pool.query('INSERT INTO backups (database_id,backup_type,size_mb,status,file_path,completed_at) VALUES ($1,$2,$3,$4,$5,NOW())',
        [did,'full',d.size*0.8,'completed',`/backups/${d.db}_${Date.now()}.sql.gz`]);
    }
    console.log('✅ Seed: 18 databases, queries, indexes, backups'); process.exit(0);
  } catch(e) { console.error(e); process.exit(1); }
}
seed();
