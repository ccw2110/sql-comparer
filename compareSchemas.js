const sql = require('msnodesqlv8');

// Configuration for the source and target databases
const sourceConfig = {
  connectionString: 'Driver={SQL Server Native Client 11.0};Server={LAPTOP-HN2EMTCC\\MSSQLSERVER2017};Database={AlconDB};Uid={sa};Pwd=Sistemas2017;'
};

const targetConfig = {
  connectionString: 'Driver={SQL Server Native Client 11.0};Server={LAPTOP-HN2EMTCC\\MSSQLSERVER2017};Database={AlconDB_Prod};Uid={sa};Pwd=Sistemas2017;'
};

async function fetchSchema(config) {
  const queryTables = `
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE 
    FROM INFORMATION_SCHEMA.COLUMNS
  `;

  const queryFunctions = `
    SELECT ROUTINE_NAME, ROUTINE_DEFINITION
    FROM INFORMATION_SCHEMA.ROUTINES 
    WHERE ROUTINE_TYPE = 'FUNCTION'
  `;

  const queryProcedures = `
    SELECT ROUTINE_NAME, ROUTINE_DEFINITION
    FROM INFORMATION_SCHEMA.ROUTINES 
    WHERE ROUTINE_TYPE = 'PROCEDURE'
  `;

  return new Promise((resolve, reject) => {
    sql.query(config.connectionString, queryTables, (err, tables) => {
      if (err) return reject(err);

      sql.query(config.connectionString, queryFunctions, (err, functions) => {
        if (err) return reject(err);

        sql.query(config.connectionString, queryProcedures, (err, procedures) => {
          if (err) return reject(err);

          resolve({
            tables: tables.reduce((acc, row) => {
              if (!acc[row.TABLE_NAME]) acc[row.TABLE_NAME] = [];
              acc[row.TABLE_NAME].push({ column: row.COLUMN_NAME, type: row.DATA_TYPE });
              return acc;
            }, {}),
            functions: functions.reduce((acc, row) => {
              acc[row.ROUTINE_NAME] = row.ROUTINE_DEFINITION;
              return acc;
            }, {}),
            procedures: procedures.reduce((acc, row) => {
              acc[row.ROUTINE_NAME] = row.ROUTINE_DEFINITION;
              return acc;
            }, {}),
          });
        });
      });
    });
  });
}

function compareSchemas(sourceSchema, targetSchema) {
  const createOrAlterScripts = [];

  // Compare tables
  for (const table in sourceSchema.tables) {
    if (!targetSchema.tables[table]) {
      createOrAlterScripts.push(`-- Create table ${table}`);
      createOrAlterScripts.push(`CREATE TABLE ${table} (...)`); // Simplified for brevity
    } else {
      const sourceColumns = sourceSchema.tables[table];
      const targetColumns = targetSchema.tables[table];

      sourceColumns.forEach(column => {
        const targetColumn = targetColumns.find(c => c.column === column.column);
        if (!targetColumn || targetColumn.type !== column.type) {
          createOrAlterScripts.push(`-- Alter table ${table} column ${column.column}`);
          createOrAlterScripts.push(`ALTER TABLE ${table} ALTER COLUMN ${column.column} ${column.type};`);
        }
      });
    }
  }

  // Compare functions
  for (const func in sourceSchema.functions) {
    if (!targetSchema.functions[func] || targetSchema.functions[func] !== sourceSchema.functions[func]) {
      createOrAlterScripts.push(`-- Create or alter function ${func}`);
      createOrAlterScripts.push(sourceSchema.functions[func]); // Simplified for brevity
    }
  }

  // Compare procedures
  for (const proc in sourceSchema.procedures) {
    if (!targetSchema.procedures[proc] || targetSchema.procedures[proc] !== sourceSchema.procedures[proc]) {
      createOrAlterScripts.push(`-- Create or alter procedure ${proc}`);
      createOrAlterScripts.push(sourceSchema.procedures[proc]); // Simplified for brevity
    }
  }

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
  }
})();
