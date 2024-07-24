const sql = require('mssql/msnodesqlv8');

// Configuration for the source and target databases
const sourceConfig = {
  user: "sa",
  password: "Sistemas2017",
  database: "AlconDB",
  //server: "LAPTOP-HN2EMTCC\\MSSQLSERVER2017",
  server: "LAPTOP-HN2EMTCC\\MSSQLSERVER2017",
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  options: {
    encrypt: false, // for azure
    trustServerCertificate: false // change to true for local dev / self-signed certs
  }
};

const targetConfig = {
  user: "sa",
  password: "Sistemas2017",
  database: "Alcon_Integracion",
  //server: "LAPTOP-HN2EMTCC\\MSSQLSERVER2017",
  server: "LAPTOP-HN2EMTCC\\MSSQLSERVER2017",
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  options: {
    encrypt: false, // for azure
    trustServerCertificate: false // change to true for local dev / self-signed certs
  }
};

async function fetchSchema(config) {
  const pool = await sql.connect(config);

  const tables = await pool.request().query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'
  `);
console.log(tables)
  const functions = await pool.request().query(`
    SELECT ROUTINE_NAME FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_TYPE = 'FUNCTION'
  `);

  const procedures = await pool.request().query(`
    SELECT ROUTINE_NAME FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_TYPE = 'PROCEDURE'
  `);

  return {
    tables: tables.recordset.map(row => row.TABLE_NAME),
    functions: functions.recordset.map(row => row.ROUTINE_NAME),
    procedures: procedures.recordset.map(row => row.ROUTINE_NAME),
  };
}

function compareSchemas(sourceSchema, targetSchema) {
  const createOrAlterScripts = [];

  // Compare tables
  sourceSchema.tables.forEach(table => {
    if (!targetSchema.tables.includes(table)) {
      createOrAlterScripts.push(`-- Script to create table ${table}`);
    }
  });

  // Compare functions
  sourceSchema.functions.forEach(func => {
    if (!targetSchema.functions.includes(func)) {
      createOrAlterScripts.push(`-- Script to create function ${func}`);
    }
  });

  // Compare procedures
  sourceSchema.procedures.forEach(proc => {
    if (!targetSchema.procedures.includes(proc)) {
      createOrAlterScripts.push(`-- Script to create procedure ${proc}`);
    }
  });

  return createOrAlterScripts.join('\n');
}

(async () => {
  try {
    const sourceSchema = await fetchSchema(sourceConfig);
    const targetSchema = await fetchSchema(targetConfig);

    const script = compareSchemas(sourceSchema, targetSchema);

    console.log(script);
  } catch (err) {
    console.error('Error comparing schemas:', err);
  } finally {
    sql.close();
  }
})();
