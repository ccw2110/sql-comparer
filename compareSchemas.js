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
  const resultScripts = [];

  // Compare tables
  for (const table in sourceSchema.tables) {
    resultScripts.push(`-- Table: ${table}`);
    if (!targetSchema.tables[table]) {
      resultScripts.push(`-- Table ${table} does not exist in target schema`);
      resultScripts.push(`CREATE TABLE ${table} (...);`); // Simplified for brevity
    } else {
      const sourceColumns = sourceSchema.tables[table];
      const targetColumns = targetSchema.tables[table];

      sourceColumns.forEach(column => {
        const targetColumn = targetColumns.find(c => c.column === column.column);
        if (!targetColumn) {
          resultScripts.push(`-- Column ${column.column} does not exist in target table ${table}`);
          resultScripts.push(`ALTER TABLE ${table} ADD COLUMN ${column.column} ${column.type};`);
        } else if (targetColumn.type !== column.type) {
          resultScripts.push(`-- Column ${column.column} in table ${table} differs`);
          resultScripts.push(`-- Source: ${column.column} ${column.type}`);
          resultScripts.push(`-- Target: ${targetColumn.column} ${targetColumn.type}`);
          resultScripts.push(`ALTER TABLE ${table} ALTER COLUMN ${column.column} ${column.type};`);
        }
      });
    }
    resultScripts.push(''); // Add a blank line for readability
  }

  // Compare functions
  for (const func in sourceSchema.functions) {
    resultScripts.push(`-- Function: ${func}`);
    if (!targetSchema.functions[func]) {
      resultScripts.push(`-- Function ${func} does not exist in target schema`);
      resultScripts.push(sourceSchema.functions[func]);
    } else if (targetSchema.functions[func] !== sourceSchema.functions[func]) {
      resultScripts.push(`-- Function ${func} differs`);
      resultScripts.push(`-- Source:`);
      resultScripts.push(sourceSchema.functions[func]);
      resultScripts.push(`-- Target:`);
      resultScripts.push(targetSchema.functions[func]);
      resultScripts.push(sourceSchema.functions[func]);
    }
    resultScripts.push(''); // Add a blank line for readability
  }

  // Compare procedures
  for (const proc in sourceSchema.procedures) {
    resultScripts.push(`-- Procedure: ${proc}`);
    if (!targetSchema.procedures[proc]) {
      resultScripts.push(`-- Procedure ${proc} does not exist in target schema`);
      resultScripts.push(sourceSchema.procedures[proc]);
    } else if (targetSchema.procedures[proc] !== sourceSchema.procedures[proc]) {
      resultScripts.push(`-- Procedure ${proc} differs`);
      resultScripts.push(`-- Source:`);
      resultScripts.push(sourceSchema.procedures[proc]);
      resultScripts.push(`-- Target:`);
      resultScripts.push(targetSchema.procedures[proc]);
      resultScripts.push(sourceSchema.procedures[proc]);
    }
    resultScripts.push(''); // Add a blank line for readability
  }

  return resultScripts;
}

(async () => {
  try {
    const sourceSchema = await fetchSchema(sourceConfig);
    const targetSchema = await fetchSchema(targetConfig);

    const scriptsArray = compareSchemas(sourceSchema, targetSchema);

    var jsonString = JSON.stringify(scriptsArray);

    console.log(jsonString);
  } catch (err) {
    console.error('Error comparing schemas:', err);
  }
})();
