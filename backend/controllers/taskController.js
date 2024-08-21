const db = require('../config/db');
const decryptToken = require('../middleware/decryptToken');

exports.createTask = (req, res) => {
  const { ProjectName, TaskName, Empname, islasttask, taskdetails, hr, min, assignDate, hrAssign, minAssign, token } = req.body;
  const userData = decryptToken(token);
  const AssignBy = userData.id;
  const taskcompletedat = (parseInt(hr) * 3600) + (parseInt(min) * 60);
  const taskcompleteat_assign = (parseInt(hrAssign) * 3600) + (parseInt(minAssign) * 60);

  let sql = `SELECT ProjectName FROM projects WHERE ProjectName = ? AND lasttask = '1'`;
  db.query(sql, [ProjectName], (err, result) => {
    if (err) {
      console.error('Error executing SQL:', err);
      res.status(500).send('Error');
    } else {
      if (result.length > 0) {
        const lasttaskchange = req.body.lasttaskchange || 0;
        if (lasttaskchange == 1) {
          let updateProjectSql = `UPDATE projects SET lasttask = ? WHERE ProjectName = ?`;
          db.query(updateProjectSql, [islasttask, ProjectName], (err, result) => {
            if (err) {
              console.error('Error updating project:', err);
              res.status(500).send('Error');
            } else {
              insertTask();
            }
          });
        } else {
          res.send('Last Task exist');
        }
      } else {
        let updateProjectSql = `UPDATE projects SET lasttask = ? WHERE ProjectName = ?`;
        db.query(updateProjectSql, [islasttask, ProjectName], (err, result) => {
          if (err) {
            console.error('Error updating project:', err);
            res.status(500).send('Error');
          } else {
            insertTask();
          }
        });
      }
    }
  });

  function insertTask() {
    let insertTaskSql = `INSERT INTO Task (projectName, TaskName, TaskTime, taskDetails, AssignBy, timetocomplete) VALUES (?, ?, NOW(), ?, ?, ?)`;
    db.query(insertTaskSql, [ProjectName, TaskName, taskdetails, AssignBy, taskcompletedat], (err, result) => {
      if (err) {
        console.error('Error inserting task:', err);
        res.status(500).send('Error');
      } else {
        const taskId = result.insertId;
        let updateProjectSql = `UPDATE projects SET lasttask = ?, taskid = ? WHERE ProjectName = ?`;
        db.query(updateProjectSql, [islasttask, taskId, ProjectName], (err, result) => {
          if (err) {
            console.error('Error updating project:', err);
            res.status(500).send('Error');
          } else {
            if (Empname !== 'Selectedemp') {
              let insertTaskEmpSql = `INSERT INTO Taskemp (taskid, tasktimeemp, AssignedTo_emp, timetocomplete_emp) VALUES (?, ?, ?, ?)`;
              db.query(insertTaskEmpSql, [taskId, assignDate, AssignBy, taskcompleteat_assign], (err, result) => {
                if (err) {
                  console.error('Error inserting task employee:', err);
                  res.status(500).send('Error');
                } else {
                  res.send('Success');
                }
              });
            } else {
              res.send('Success');
            }
          }
        });
      }
    });
  }
};

exports.taskOverview = (req, res) => {
  const token = req.body.token;
  const is_complete = req.body.is_complete;

  if (!token) {
    return res.status(400).send('Token is required');
  }

  const userData = decryptToken(token);
  const U_type = userData.Type;
  const u_id = userData.id;
  let arrselectemptask = [];

  const selectTaskEmpQuery = `SELECT DISTINCT taskid FROM Taskemp WHERE AssignedTo_emp = ?`;
  db.query(selectTaskEmpQuery, [u_id], (err, taskResults) => {
    if (err) {
      console.error('Error executing task query:', err.stack);
      return res.status(500).send('Database query error');
    }

    arrselectemptask = taskResults.map(row => row.taskid);

    getProjSortingAndProjects();
  });

  function getProjSortingAndProjects() {
    const loginQuerySort = `SELECT projsorting FROM Logincrd WHERE id = ?`;
    db.query(loginQuerySort, [u_id], (err, loginResults) => {
      if (err) {
        console.error('Error executing login query:', err.stack);
        return res.status(500).send('Database query error');
      }

      const proj_sort_str = loginResults.length > 0 ? loginResults[0].projsorting : '';
      const proj_sort = proj_sort_str ? proj_sort_str.split(' ') : [];

      let selectProjectQuery;
      if (proj_sort_str === '') {
        selectProjectQuery = `SELECT * FROM projects`;
      } else {
        const sort_Status = proj_sort.map(status => `'${status}'`).join(',');
        selectProjectQuery = `SELECT * FROM projects WHERE Status IN (${sort_Status})`;
      }

      db.query(selectProjectQuery, (err, projectResults) => {
        if (err) {
          console.error('Error executing project query:', err.stack);
          return res.status(500).send('Database query error');
        }

        let response = [];
        let count = 0;
        projectResults.forEach(project => {
          const projectId = project.id;
          const projectName = project.ProjectName;
          const projectSalesOrder = project.sales_order;
          const proj_status = project.Status;
          const projectLastTask = project.lasttask;

          let selcttask;
          selcttask = `SELECT te.id, te.taskid, p.TaskName, te.timetocomplete_emp, p.timetocomplete, SUM(te.actualtimetocomplete_emp) AS total_actual_time,p.taskDetails,p.Status, p.aproved FROM Taskemp te JOIN Task p ON te.taskid = p.id WHERE te.AssignedTo_emp = ? AND p.ProjectName = ? GROUP BY te.taskid, p.TaskName ORDER BY te.taskid;`;


          db.query(selcttask, [u_id, projectName], (err, taskResults) => {
            if (err) {
              console.error('Error executing task query:', err.stack);
              return res.status(500).send('Database query error');
            }

            let assigntaskpresent = taskResults.length > 0;
            let noofassigntasks = taskResults.length;
            // Prepare task details for each task
            const tasks = taskResults.map(task => ({
              taskId: task.taskid,
              taskempId: task.id,
              taskName: task.TaskName,
              taskGivenTime: task.timetocomplete_emp,
              taskRequiredTime: task.timetocomplete,
              taskActualTime: task.total_actual_time,
              taskDetails: task.taskDetails,
              taskStatus: task.Status,
              taskAproved: task.aproved
            }));

            const timeQuery = `SELECT sum(p.timetocomplete) as required, sum(te.actualtimetocomplete_emp) as taken FROM Taskemp te JOIN Task p ON te.taskid = p.id WHERE te.AssignedTo_emp = ? AND p.ProjectName = ?`;
            db.query(timeQuery, [u_id, projectName], (err, timeResults) => {
              if (err) {
                console.error('Error executing time query:', err.stack);
                return res.status(500).send('Database query error');
              }

              const requiredTime = timeResults[0].required || 0;
              const takenTime = timeResults[0].taken || 0;

              response.push({
                projectId,
                projectName,
                projectSalesOrder,
                assigntaskpresent,
                noofassigntasks,
                proj_status,
                projectLastTask,
                requiredTime,
                takenTime,
                tasks
              });

              count++;
              if (count === projectResults.length) {
                res.json(response);
              }
            });
          });
        });
      });
    });
  }
};

exports.aggViewPATimes = (req, res) => {
  const projectName = req.body.projectName;
  const dates = req.body.dates;

  const sqlGetTaskIds = `
    SELECT id
    FROM Task
    WHERE projectName = ?
  `;

  db.query(sqlGetTaskIds, projectName, (err, taskResults) => {
    if (err) {
      console.log('Error executing task ID query:', err);
      res.status(500).json({ error: 'Error executing task ID query' });
      return;
    }

    // Extract task IDs from the results
    const taskIds = taskResults.map(result => result.id);

    // Query to get SUMs from Taskemp table based on dates and task IDs
    const sqlGetSums = `
      SELECT SUM(timetocomplete_emp) AS planned,
             SUM(actualtimetocomplete_emp) AS actual
      FROM Taskemp
      WHERE DATE(tasktimeemp) IN (?)
        AND taskid IN (?)
    `;

    db.query(sqlGetSums, [dates, taskIds], (err, sumResults) => {
      if (err) {
        console.log('Error executing SUM query:', err);
        res.status(500).json({ error: 'Error executing SUM query' });
        return;
      }

      const summary = sumResults[0];
      res.json(summary);
    });
  });
};

exports.indViewPATimes = (req, res) => {
  const projectName = req.body.projectName;
  const dates = req.body.dates;

  const sqlGetTaskIds = `
    SELECT id
    FROM Task
    WHERE projectName = ?
  `;

  db.query(sqlGetTaskIds, projectName, (err, taskResults) => {
    if (err) {
      console.log('Error executing task ID query:', err);
      res.status(500).json({ error: 'Error executing task ID query' });
      return;
    }

    const taskIds = taskResults.map(result => result.id);

    const sqlGetSums = `
      SELECT taskid, timetocomplete_emp AS planned,
             actualtimetocomplete_emp AS actual
      FROM Taskemp
      WHERE DATE(tasktimeemp) IN (?)
        AND taskid IN (?)
    `;

    db.query(sqlGetSums, [dates, taskIds], (err, sumResults) => {
      if (err) {
        console.log('Error executing ind query:', err);
        res.status(500).json({ error: 'Error executing SUM query' });
        return;
      }

      res.json(sumResults);
    });
  });
};

exports.taskInfoDialog = (req, res) => {
  const { token, taskId } = req.body;

  if (!token || !taskId) {
    return res.status(400).json({ error: 'Token and taskId are required' });
  }

  try {
    const userData = decryptToken(token);
    const userId = userData.id;
    const userType = userData.Type;
    const userName = userData.Name;

    let query = '';

    if (userType === 'Employee') {
      query = `SELECT * FROM Taskemp WHERE AssignedTo_emp = '${userId}' AND taskid = '${taskId}'`;
    } else {
      query = `SELECT * FROM Taskemp WHERE taskid = '${taskId}'`;
    }

    db.query(query, (error, results) => {
      if (error) {
        return res.status(500).json({ error: 'Database query failed' });
      }
      return res.status(200).json({ results, userName });
    });
  } catch (err) {
    return res.status(400).json({ error: 'Invalid token' });
  }
};

exports.completeTask = (req, res) => {
  const { id, min, hr, msg, tid, isChecked, isChecked2, isChecked3, token } = req.body;

  let userData;
  try {
    userData = decryptToken(token);
  } catch (err) {
    return res.status(400).send('Invalid token');
  }

  const AssignBy = userData.id;

  let checkval = '';
  const taskcomleteat = (parseInt(hr) * 3600) + (parseInt(min) * 60);

  if (isChecked) {
    checkval = '1';
  } else if (isChecked2) {
    checkval = '2';
  } else if (isChecked3) {
    checkval = '0';
  }

  const updateTaskQuery = `UPDATE Task SET Status=?, statusby=? WHERE id=?`;
  const updateTaskValues = [checkval, AssignBy, tid];

  db.query(updateTaskQuery, updateTaskValues, (err, result) => {
    if (err) {
      return res.status(500).send('Error updating task');
    }

    let updateTaskEmpQuery = '';
    if (msg === '') {
      updateTaskEmpQuery = `UPDATE Taskemp SET actualtimetocomplete_emp=? WHERE id=?`;
    } else {
      updateTaskEmpQuery = `UPDATE Taskemp SET actualtimetocomplete_emp=?, tasklog=? WHERE id=?`;
    }
    const updateTaskEmpValues = msg === '' ? [taskcomleteat, id] : [taskcomleteat, msg, id];

    db.query(updateTaskEmpQuery, updateTaskEmpValues, (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).send('Error');
      }
      res.send('Success');
    });
  });
};

exports.EmpOverviewtaskDtlsAggView = async (req, res) => {
  const { empid, iscomplete } = req.body;

  try {
    // Get the distinct task IDs
    const taskIdsResult = await query(`SELECT DISTINCT taskid FROM Taskemp WHERE AssignedTo_emp = ?`, [empid]);

    if (!Array.isArray(taskIdsResult) || taskIdsResult.length === 0) {
      return res.status(200).send([]);
    }

    const taskIds = taskIdsResult.map(row => row.taskid);

    // Get the distinct project names
    const projectNamesResult = await query(`SELECT DISTINCT projectName FROM Task WHERE id IN (?)`, [taskIds]);

    if (!Array.isArray(projectNamesResult) || projectNamesResult.length === 0) {
      return res.status(200).send([]);
    }

    const projectNames = projectNamesResult.map(row => row.projectName);

    // Create the base query
    let sql = `SELECT * FROM Task WHERE projectName IN (?) AND id IN (?)`;
    const params = [projectNames, taskIds];

    if (!iscomplete) {
      sql += ` AND aproved = '0'`;
    }

    // Execute the final query
    const tasksResult = await query(sql, params);

    res.status(200).send(tasksResult);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).send('Internal server error');
  }
};

function query(sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, results) => {
      if (error) {
        return reject(error);
      }
      resolve(results);
    });
  });
}

exports.emptaskDtlsAggTimes = async (req, res) => {
  const { empid, iscomplete } = req.body;

  try {
    // Step 1: Get assigned task IDs
    const [taskRows] = await db.promise().query(
      'SELECT DISTINCT taskid FROM Taskemp WHERE AssignedTo_emp = ?',
      [empid]
    );

    if (!Array.isArray(taskRows)) {
      throw new TypeError('Expected taskRows to be an array');
    }

    const assignedTaskIds = taskRows.map(row => row.taskid);

    if (assignedTaskIds.length === 0) {
      return res.status(200).send('No tasks found for the given employee');
    }

    // Step 2: Get filtered task IDs based on completion status
    let filteredTaskQuery = 'SELECT id FROM Task WHERE id IN (?)';
    if (!iscomplete) {
      filteredTaskQuery += ' AND aproved = 0';
    }
    const [filteredTaskRows] = await db.promise().query(filteredTaskQuery, [assignedTaskIds]);

    if (!Array.isArray(filteredTaskRows)) {
      throw new TypeError('Expected filteredTaskRows to be an array');
    }

    const filteredTaskIds = filteredTaskRows.map(row => row.id);

    if (filteredTaskIds.length === 0) {
      return res.status(404).send('No matching tasks found');
    }

    // Step 3: Get the required time to complete
    const [requiredTimeRows] = await db.promise().query(
      'SELECT SUM(timetocomplete) AS required FROM Task WHERE id IN (?)',
      [filteredTaskIds]
    );

    if (!Array.isArray(requiredTimeRows)) {
      throw new TypeError('Expected requiredTimeRows to be an array');
    }

    const requiredTime = requiredTimeRows[0]?.required || 0;

    // Step 4: Get the actual time taken to complete
    const [actualTimeRows] = await db.promise().query(
      'SELECT SUM(actualtimetocomplete_emp) AS taken FROM Taskemp WHERE id IN (?)',
      [filteredTaskIds]
    );

    if (!Array.isArray(actualTimeRows)) {
      throw new TypeError('Expected actualTimeRows to be an array');
    }

    const actualTime = actualTimeRows[0]?.taken || 0;

    res.json({ required: requiredTime, taken: actualTime });
  } catch (error) {
    console.error('Database query error:', error);
    res.status(500).send('Internal server error');
  }
};

exports.empAggtasktimes = (req, res) => {
  const { startDate, endDate, assignedToEmp } = req.query;

  const query = `
    WITH RECURSIVE date_range AS (
      SELECT DATE(?) AS taskDate
      UNION ALL
      SELECT taskDate + INTERVAL 1 DAY
      FROM date_range
      WHERE taskDate + INTERVAL 1 DAY <= DATE(?)
    )
    SELECT
      dr.taskDate,
      COALESCE(SUM(te.timetocomplete_emp), 0) AS planned,
      COALESCE(SUM(te.actualtimetocomplete_emp), 0) AS actual
    FROM date_range dr
    LEFT JOIN Taskemp te ON dr.taskDate = DATE(te.tasktimeemp) AND te.AssignedTo_emp = ?
    GROUP BY dr.taskDate;
  `;

  db.query(query, [startDate, endDate, assignedToEmp], (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      res.json(results);
    }
  });
};

exports.empOverviewTaskDtlsIndAggView = (req, res) => {
  const assignBy = req.query.assignBy;
  const projectName = req.query.projectName;

  // First query to get task IDs for the given project name
  const initialQuery = `
    SELECT id as tasks 
    FROM Task 
    WHERE projectName = ?;
  `;



  // Third query to sum up time to complete and actual time taken for tasks assigned to a specific employee
  const query2 = `
    SELECT SUM(p.timetocomplete) as Required, SUM(te.actualtimetocomplete_emp) as Taken 
    FROM Taskemp te 
    JOIN Task p ON te.taskid = p.id 
    WHERE te.AssignedTo_emp = ? 
      AND p.ProjectName = ?;
  `;

  // Execute the initial query
  db.query(initialQuery, [projectName], (errorInitial, resultsInitial) => {
    if (errorInitial) {
      return res.status(500).json({ error: errorInitial.message });
    }

    // Extract task IDs and format them as a comma-separated string
    const taskIds = resultsInitial.map(task => task.tasks).join(',');

    const query1 = `
      SELECT COUNT(DISTINCT taskid) as tasks
      FROM Taskemp
      WHERE taskid IN (${taskIds}) 
        AND AssignedTo_emp = ?;
    `;

    // Execute the first query using the obtained task IDs
    db.query(query1, [assignBy], (error1, results1) => {
      if (error1) {
        return res.status(500).json({ error: error1.message });
      }

      // Execute the second query
      db.query(query2, [assignBy, projectName], (error2, results2) => {
        if (error2) {
          return res.status(500).json({ error: error2.message });
        }

        res.json({
          tasks: results1[0].tasks,
          required: results2[0].Required,
          taken: results2[0].Taken
        });
      });
    });
  });
};

exports.empOverviewIndAggPATimes = (req, res) => {
  const { projectName, userId, startDate } = req.query;

  const taskIdQuery = `
    SELECT id 
    FROM Task 
    WHERE projectName = ?
  `;

  db.query(taskIdQuery, [projectName], (err, taskIds) => {
    if (err) {
      console.error('Error executing task ID query:', err);
      return res.status(500).json({ message: 'Internal server error', error: err.message });
    }

    const taskIdList = taskIds.map(task => task.id);

    if (taskIdList.length === 0) {
      return res.status(200).json({ message: 'No tasks found for the given criteria', data: [] });
    }

    // Convert taskIdList to a comma-separated string
    const taskIdString = taskIdList.join(', ');

    // Generate the array of dates within the range
    const startDateObj = new Date(startDate);
    const dateArray = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDateObj);
      date.setDate(date.getDate() + i);
      dateArray.push(date.toISOString().split('T')[0]);
    }

    // Convert dateArray to a comma-separated string for the SQL query
    const dateArrayString = dateArray.map(date => `'${date}'`).join(', ');

    // Step 2: Get planned and actual time data within the date range
    const taskDataQuery = `
      SELECT 
        DATE(tasktimeemp) AS date, 
        SUM(timetocomplete_emp) AS planned, 
        SUM(actualtimetocomplete_emp) AS actual 
      FROM Taskemp 
      WHERE taskid IN (${taskIdString}) 
      AND AssignedTo_emp = ? 
      AND DATE(tasktimeemp) IN (${dateArrayString}) 
      GROUP BY DATE(tasktimeemp)
    `;

    db.query(taskDataQuery, [userId], (err, taskData) => {
      if (err) {
        console.error('Error executing task data query:', err);
        return res.status(500).json({ message: 'Internal server error', error: err.message });
      }

      // Format the dates to local date format
      const formattedData = taskData.map(row => {
        const taskDate = new Date(row.date);
        // Adjust the date for the desired output format (DD-MM-YYYY)
        const adjustedDate = new Date(taskDate.getTime() - taskDate.getTimezoneOffset() * 60000); // Adjust for timezone offset
        const day = String(adjustedDate.getDate()).padStart(2, '0');
        const month = String(adjustedDate.getMonth() + 1).padStart(2, '0'); // Months are zero-based
        const year = adjustedDate.getFullYear();
        return {
          taskDate: `${year}-${month}-${day}`,
          planned: row.planned,
          actual: row.actual
        };
      });

      res.status(200).json({ message: 'Success', data: formattedData });
    });
  });
};

exports.task = (req, res) => {
  const projectName = req.query.projectName;

  if (!projectName) {
    return res.status(400).send('Project name is required');
  }

  const query = 'SELECT * FROM `Task` WHERE `projectName` = ?';
  db.query(query, [projectName], (err, results) => {
    if (err) {
      console.error('Error fetching tasks:', err);
      return res.status(500).send('Error fetching tasks');
    }

    res.json(results);
  });
};

exports.assignTask = (req, res) => {
  const {
    valuetask,
    inputminaray,
    inputhraray,
    Activity,
    Dateassign,
    token
  } = req.body;

  const userData = decryptToken(token);
  const empid = userData.id;

  const date = new Date(Dateassign);
  date.setHours(0, 0, 1); // Set hours, minutes, seconds to 00:00:01
  const todaydatetime = date.toISOString().split('T')[0] + ' 00:00:01';
  const todaydatetime2 = date.toISOString().replace('T', ' ').slice(0, 19);

  const selectQuery = `SELECT * FROM Taskemp WHERE DATE(tasktimeemp) = ? AND taskid = ? AND AssignedTo_emp = ?`;
  db.query(selectQuery, [todaydatetime.split(' ')[0], valuetask, empid], (err, result) => {
    if (err) throw err;

    const taskcomleteat = parseInt(inputhraray) * 3600 + parseInt(inputminaray) * 60;

    if (result.length > 0) {
      const updateQuery = `UPDATE Taskemp SET timetocomplete_emp = ?, Activity = ? WHERE DATE(tasktimeemp) = ? AND taskid = ? AND AssignedTo_emp = ?`;
      db.query(updateQuery, [taskcomleteat, Activity, todaydatetime.split(' ')[0], valuetask, empid], (err, result) => {
        if (err) throw err;

        const query = `SELECT * FROM Logincrd WHERE id = ?`;
        db.query(query, [empid], (err, queryResult) => {
          if (err) throw err;
          const rowqueryResult = queryResult[0];
          const finalmsg = 'Task already assigned to ' + rowqueryResult.Name + '.';
          res.send(finalmsg);
        });
      });
    } else {
      const insertQuery = `INSERT INTO Taskemp (taskid, tasktimeemp, timetocomplete_emp, taskDetails_emp, AssignedTo_emp, Activity) VALUES (?, ?, ?, ?, ?, ?)`;
      db.query(insertQuery, [valuetask, todaydatetime, taskcomleteat, '', empid, Activity], (err, result) => {
        if (err) throw err;

        const query = `SELECT * FROM Logincrd WHERE id = ?`;
        db.query(query, [empid], (err, queryResult) => {
          if (err) throw err;
          const rowqueryResult = queryResult[0];
          const finalmsg = 'Task assigned successfully to ' + rowqueryResult.Name + '.';
          res.send(finalmsg);
        });
      });
    }
  });
};

exports.employeeLogs = async (req, res) => {
  const { employeeId, fromDate, toDate } = req.body;

  // Validate input
  if (!employeeId || !fromDate || !toDate) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  // Log input values
  // console.log('Employee ID:', employeeId);
  // console.log('From Date:', fromDate);
  // console.log('To Date:', toDate);

  const query = `
        SELECT te.*, t.projectName, t.TaskName
        FROM Taskemp te
        JOIN Task t ON te.taskid = t.id
        WHERE te.AssignedTo_emp = ?
          AND DATE(te.tasktimeemp) BETWEEN ? AND ?
        ORDER BY te.tasktimeemp DESC
      `;

  try {
    // Execute the combined query
    const [results] = await db.promise().query(query, [employeeId, fromDate, toDate]);

    // Log raw results
    // console.log('Raw results length:', results.length);
    // console.log('Raw results:', results);

    // Map results to the final structure
    const finalResults = results.map(row => ({
      results: results.length,
      date: row.tasktimeemp,
      projectName: row.projectName || 'Unknown',
      taskName: row.TaskName || 'Unknown',
      timeRequired: row.timetocomplete_emp,
      timeTaken: row.actualtimetocomplete_emp,
      activity: row.Activity,
      logs: row.tasklog
    }));

    // Log final mapped results
    // console.log('Final results length:', finalResults.length);
    // console.log('Final results:', finalResults);

    res.json(finalResults);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.empOverviewTaskDtlsIndIndView = async (req, res) => {
  const { assignBy, projectName } = req.query;

  try {
    // 1a. Get task IDs based on the projectName
    const taskIdsQuery = `SELECT id FROM Task WHERE projectName = ?`;
    const taskIdsResult = await new Promise((resolve, reject) => {
      db.query(taskIdsQuery, [projectName], (error, results) => {
        if (error) return reject(error);
        resolve(results);
      });
    });

    // Extract task IDs and join them into a string
    const taskIds = taskIdsResult.map(task => task.id).join(',');

    // 1b. Use the task IDs to query taskemp for distinct task IDs assigned to a specific employee
    const distinctTaskIdsQuery = `SELECT DISTINCT(taskid) FROM Taskemp WHERE taskid IN (${taskIds}) AND AssignedTo_emp = ?`;
    const distinctTaskIdsResult = await new Promise((resolve, reject) => {
      db.query(distinctTaskIdsQuery, [assignBy], (error, results) => {
        if (error) return reject(error);
        resolve(results);
      });
    });

    // Extract distinct task IDs and join them into a string
    const distinctTaskIds = distinctTaskIdsResult.map(task => task.taskid).join(',');

    // 1c. Use the distinct task IDs to get the task details
    const tasksQuery = `SELECT * FROM Task WHERE id IN (${distinctTaskIds})`;
    const tasks = await new Promise((resolve, reject) => {
      db.query(tasksQuery, (error, results) => {
        if (error) return reject(error);
        resolve(results);
      });
    });

    const taskempQuery = `
      SELECT t.*, total.actual FROM Taskemp t JOIN ( SELECT taskid, SUM(actualtimetocomplete_emp) AS actual FROM Taskemp WHERE taskid IN (${taskIds}) GROUP BY taskid ) total ON t.taskid = total.taskid WHERE t.taskid IN (${taskIds});
    `;
    const taskemps = await new Promise((resolve, reject) => {
      db.query(taskempQuery, (error, results) => {
        if (error) return reject(error);
        resolve(results);
      });
    });

    res.json({
      tasks,
      taskemps
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.empOverviewIndIndPATimes = (req, res) => {
  const { projectName, assignedTo, taskDates } = req.query;

  // Validate taskDates format (assume it's a comma-separated list of dates)
  if (!taskDates || !Array.isArray(taskDates.split(','))) {
    return res.status(400).json({ error: 'Invalid taskDates format' });
  }

  const dateArray = taskDates.split(',').map(date => new Date(date).toISOString().split('T')[0]);

  // Query 1: Fetch all tasks for the given project
  const query1 = `
    SELECT id
    FROM Task 
    WHERE projectName = ?;
  `;

  db.query(query1, [projectName], (err, tasks) => {
    if (err) {
      return res.status(500).json({ error: 'Error executing query1' });
    }

    // Extract task IDs
    const taskIds = tasks.map(task => task.id);

    if (taskIds.length === 0) {
      return res.status(200).json([]);
    }

    // Create a comma-separated list of IDs for the SQL query
    const taskIdsList = taskIds.join(',');

    // Query 2: Fetch details from taskemp for the given tasks and assigned employee
    const query2 = `
      SELECT id, taskid, actualtimetocomplete_emp, DATE(tasktimeemp) as tasktimeemp_date, timetocomplete_emp
      FROM Taskemp 
      WHERE taskid IN (${taskIdsList})
        AND AssignedTo_emp = ?
        AND DATE(tasktimeemp) IN (?);
    `;

    // Use a prepared statement for query2
    db.query(query2, [assignedTo, dateArray], (err, taskEmpDetails) => {
      if (err) {
        return res.status(500).json({ error: 'Error executing query2' });
      }

      // Create a map for easy lookup
      const empDetailsMap = taskEmpDetails.reduce((acc, curr) => {
        let tasktimeemp_date = new Date(curr.tasktimeemp_date);
        tasktimeemp_date.setDate(tasktimeemp_date.getDate() + 1);
        tasktimeemp_date = tasktimeemp_date.toISOString().split('T')[0];

        acc[curr.taskid] = {
          id: curr.id, // Store the id from taskemp
          actualtimetocomplete_emp: curr.actualtimetocomplete_emp,
          tasktimeemp_date: tasktimeemp_date,
          timetocomplete_emp: curr.timetocomplete_emp
        };
        return acc;
      }, {});

      // Combine the results
      const combinedResults = tasks.map(task => ({
        taskid: task.id,
        id: empDetailsMap[task.id] ? empDetailsMap[task.id].id : null, // Add id to combinedResults
        planned: empDetailsMap[task.id] ? empDetailsMap[task.id].timetocomplete_emp : null,
        actual: empDetailsMap[task.id] ? empDetailsMap[task.id].actualtimetocomplete_emp : null,
        taskDate: empDetailsMap[task.id] ? empDetailsMap[task.id].tasktimeemp_date : null,
      }));

      res.json(combinedResults);
    });
  });
};