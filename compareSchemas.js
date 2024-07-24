const sql = require('msnodesqlv8');

// Configuration for the source and target databases
const sourceConfig = {
  connectionString: 'Driver={SQL Server Native Client 11.0};Server={sourceServer};Database={sourceDatabase};Trusted_Connection={yes};'
};

const targetConfig = {
  connectionString: 'Driver={SQL Server Native Client 11.0};Server={targetServer};Database={targetDatabase};Trusted_Connection={yes};'
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
  const resultArray = [];

  // Compare tables
  for (const table in sourceSchema.tables) {
    if (!targetSchema.tables[table]) {
      resultArray.push([
        `Table: ${table}`,
        `CREATE TABLE ${table} (...);`, // Simplified for brevity
        JSON.stringify(sourceSchema.tables[table], null, 2),
        'Table does not exist in target schema'
      ]);
    } else {
      const sourceColumns = sourceSchema.tables[table];
      const targetColumns = targetSchema.tables[table];

      sourceColumns.forEach(column => {
        const targetColumn = targetColumns.find(c => c.column === column.column);
        if (!targetColumn) {
          resultArray.push([
            `Column: ${column.column} in Table: ${table}`,
            `ALTER TABLE ${table} ADD COLUMN ${column.column} ${column.type};`,
            JSON.stringify(column, null, 2),
            'Column does not exist in target table'
          ]);
        } else if (targetColumn.type !== column.type) {
          resultArray.push([
            `Column: ${column.column} in Table: ${table}`,
            `ALTER TABLE ${table} ALTER COLUMN ${column.column} ${column.type};`,
            JSON.stringify(column, null, 2),
            JSON.stringify(targetColumn, null, 2)
          ]);
        }
      });
    }
  }

  // Compare functions
  for (const func in sourceSchema.functions) {
    if (!targetSchema.functions[func]) {
      resultArray.push([
        `Function: ${func}`,
        sourceSchema.functions[func],
        sourceSchema.functions[func],
        'Function does not exist in target schema'
      ]);
    } else if (targetSchema.functions[func] !== sourceSchema.functions[func]) {
      resultArray.push([
        `Function: ${func}`,
        sourceSchema.functions[func],
        sourceSchema.functions[func],
        targetSchema.functions[func]
      ]);
    }
  }

  // Compare procedures
  for (const proc in sourceSchema.procedures) {
    if (!targetSchema.procedures[proc]) {
      resultArray.push([
        `Procedure: ${proc}`,
        sourceSchema.procedures[proc],
        sourceSchema.procedures[proc],
        'Procedure does not exist in target schema'
      ]);
    } else if (targetSchema.procedures[proc] !== sourceSchema.procedures[proc]) {
      resultArray.push([
        `Procedure: ${proc}`,
        sourceSchema.procedures[proc],
        sourceSchema.procedures[proc],
        targetSchema.procedures[proc]
      ]);
    }
  }

  return resultArray;
}

(async () => {
  try {
    const sourceSchema = await fetchSchema(sourceConfig);
    const targetSchema = await fetchSchema(targetConfig);

    const scriptsArray = compareSchemas(sourceSchema, targetSchema);

    console.log(scriptsArray);
  } catch (err) {
    console.error('Error comparing schemas:', err);
  }
})();
