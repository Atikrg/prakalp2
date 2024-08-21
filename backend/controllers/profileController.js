const db = require('../config/db');
const decryptToken = require('../middleware/decryptToken');
const { OAuth2Client } = require('google-auth-library');



// Use environment variable
const client = new OAuth2Client(process.env.NODE_APP_GOOGLE_CLIENT_ID);

// Google OAuth2 Callback Route
exports.googlelogin = async (req, res) => {
  const { token } = req.query;

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.NODE_APP_GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email } = payload;

    // Check if user exists in database
    const selectlogin = `SELECT * FROM Logincrd WHERE Email=?`;

    db.query(selectlogin, [email], (err, result) => {
      if (err) {
        console.error(err);
        res.status(500).send('Error');
        return;
      }

      if (result.length === 0) {
        // You may want to create a new user here if they don't exist
        return res.status(401).send('Error: User not found');
      }

      // Set cookies or other session logic
      res.cookie('username', email, { maxAge: 30 * 24 * 3600 * 1000, httpOnly: true });
      res.send({ message: 'Success', result: result });
    });
  } catch (error) {
    res.status(401).send('Error: Invalid Google token');
  }
};

exports.register = (req, res) => {
  const { email, fname, lname, slectedval, passwd } = req.body;
  console.log("req.body : ", req);
  const password = Buffer.from(passwd).toString('base64'); // Encrypting password

  const selectQuery = 'SELECT * FROM Logincrd WHERE Email=? OR Password=?';
  db.query(selectQuery, [email, password], (error, results) => {
    if (error) {
      res.status(500).json({ message: 'Error occurred while executing query' });
      return;
    }

    if (results.length > 0) {
      res.status(400).json({ message: 'User already exists' });
      return;
    }

    const insertQuery = 'INSERT INTO Logincrd (Name, Nickname, Email, Password, Type, Location) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(insertQuery, [fname, lname, email, password, 'Employee', slectedval], (error, results) => {
      if (error) {
        res.status(500).json({ message: 'Error occurred while inserting data' });
        return;
      }

      res.status(200).json({ message: 'Success' });
    });
  });
};

exports.getLogin = (req, res) => {
  const { email, pass, rememberMe } = req.body;

  const selectlogin = `SELECT * FROM Logincrd WHERE Email=? AND Password=?`;

  db.query(selectlogin, [email, pass], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send('Error');
      return;
    }

    if (result.length === 0) {
      return res.status(401).send('Error: Invalid credentials');
    }

    if (rememberMe === 'true') {
      res.cookie('username', email, { maxAge: 30 * 24 * 3600 * 1000, httpOnly: true });
      res.cookie('password', pass, { maxAge: 30 * 24 * 3600 * 1000, httpOnly: true });
    } else {
      res.clearCookie('username');
      res.clearCookie('password');
    }
    res.send({ message: 'Success', result: result });
  });
};

exports.updateUser = (req, res) => {
  const { id, name, Email, Password, location } = req.body;
  const passwordBase64 = Buffer.from(Password).toString('base64');

  const checkQuery = `SELECT * FROM Logincrd WHERE id=?`;
  db.query(checkQuery, [id], (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).send('Error');
      return;
    }

    if (results.length > 0) {
      const user = results[0];
      if (
        user.Name === name &&
        user.Email === Email &&
        user.Password === passwordBase64 &&
        user.Location === location
      ) {
        res.status(400).send('User already exists');
        return;
      }

      const updateQuery = `UPDATE Logincrd SET Name=?, Email=?, Password=?, Location=? WHERE id=?`;
      db.query(updateQuery, [name, Email, passwordBase64, location, id], (err, result) => {
        if (err) {
          console.error('Error updating user:', err);
          res.status(500).send('Error');
          return;
        }
        res.status(200).send('Success');
      });
    } else {
      res.status(404).send('User not found');
    }
  });
};

exports.getProfile = (req, res) => {
  const { U_id } = req.body;
  const query = "SELECT * FROM Logincrd WHERE id = ?";
  db.query(query, [U_id], (err, result) => {
    if (err) return res.status(500).send(err);
    if (result.length > 0) {
      const user = result[0];
      user.password = Buffer.from(user.Password, 'base64').toString('utf8');
      if (!user.Location) user.Location = 'Ratnagiri';
      res.json(user);
    } else {
      res.status(404).send('User not found');
    }
  });
};

exports.empDropdown = (req, res ) => {
  const { token } = req.body;
  const userData = decryptToken(token);
  if (userData.Type !== 'Admin' && userData.Type !== 'Team Leader') {
    const query = `SELECT * FROM Logincrd WHERE id='${userData.id}' AND disableemp!='1' ORDER BY Name ASC`;
    db.query(query, (err, result) => {
      if (err) {
        console.error('Error executing query:', err);
        res.status(500).send('Internal Server Error');
      } else {
        res.json(result);
      }
    });
  } else {
    const query = `SELECT * FROM Logincrd WHERE disableemp!='1' ORDER BY Name ASC`;
    db.query(query, (err, result) => {
      if (err) {
        console.error('Error executing query:', err);
        res.status(500).send('Internal Server Error');
      } else {
        res.json(result);
      }
    });
  }
};

exports.addemployee = async (req, res ) => {
  const { Name, fname, lname, Nickname, Email, Password, Type, Location, loginusinggmail, pagename, pagevalue } = req.body;

  // Validate and sanitize input if needed (e.g., using a library like validator)

  // Create employee object
  const emp = {
    Name,
    fname,
    lname,
    Nickname,
    Email,
    Password, // The password should be Base64 encoded
    Type,
    Location,
    loginusinggmail
  };
  

  // SQL query to insert employee data
  const sql = 'INSERT INTO logincrd SET ?';
  db.query(sql, emp, (err, result) => {
    if (err) {
      console.error('Error inserting employee:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    console.log('New employee inserted');

    // Fetch the ID of the latest created employee
    const fetchLatestId = 'SELECT id FROM logincrd ORDER BY id DESC LIMIT 1';
    db.query(fetchLatestId, (err, result) => {
      if (err) {
        console.error('Error fetching latest employee ID:', err);
        return res.status(500).json({ message: 'Internal server error' });
      }

      const latestId = result[0].id;

      // Create an array of promises for inserting access data
      const insertPromises = pagename.map((val, index) => {
        const acessval = pagevalue[index];
        const empAccess = {
          Empid: latestId,
          AcessTo: val,
          acesstype: acessval
        };

        const insertEmpAccess = 'INSERT INTO empacess SET ?';
        return new Promise((resolve, reject) => {
          db.query(insertEmpAccess, empAccess, (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          });
        });
      });

      Promise.all(insertPromises)
        .then(() => {
          console.log('Employee access inserted');
          res.status(200).json({ message: 'Employee and access inserted successfully' });
        })

        .catch(err => {
          console.error('Error inserting access data:', err);
          res.status(500).json({ message: 'Internal server error' });
        });
    });
  });
};

exports.editEmpAccessData = (req, res ) => {
  const empId = req.query.Empid;

  if (!empId) {
    return res.status(400).json({ error: 'Empid query parameter is required' });
  }

  const query = 'SELECT * FROM empacess WHERE Empid = ? ORDER BY `id` DESC LIMIT 3';
  db.query(query, [empId], (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).json({ error: 'Database query failed' });
    }

    res.json(results);
  });
};

exports.updateemployee = (req, res ) => {
  const { Email, Password, Type, selctloc, loginusinggmail, empid, Name, Nickname, pagename, pagevalue } = req.body;
  const password = Buffer.from(Password).toString('base64');

  const updateQuery = `
    UPDATE Logincrd
    SET Name = ?, Email = ?, Password = ?, Type = ?, Location = ?, loginusinggmail = ?, Nickname = ?
    WHERE id = ?
  `;

  const updateValues = [Name, Email, password, Type, selctloc, loginusinggmail, Nickname, empid];

  db.query(updateQuery, updateValues, (err, result) => {
    if (err) {
      console.error('Error updating employee:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const selectQuery = `
      SELECT id
      FROM Logincrd
      WHERE Email = ? AND Password = ? AND Name = ? AND Type = ? AND Location = ?
    `;

    const selectValues = [Email, password, Name, Type, selctloc];

    db.query(selectQuery, selectValues, (err, rows) => {
      if (err) {
        console.error('Error retrieving employee ID:', err);
        return res.status(500).json({ message: 'Internal server error' });
      }

      if (rows.length === 0) {
        return res.status(404).json({ message: 'Employee not found after update' });
      }

      const tempid = rows[0].id;

      const insertPromises = pagename.map((val, index) => {
        const acessval = pagevalue[index];
        const insertQuery = `
          INSERT INTO EmpAcess (Empid, AcessTo, acesstype)
          VALUES (?, ?, ?)
        `;
        return new Promise((resolve, reject) => {
          db.query(insertQuery, [tempid, val, acessval], (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          });
        });
      });

      Promise.all(insertPromises)
        .then(() => {
          res.status(200).json({ message: 'Success' });
        })
        .catch(err => {
          console.error('Error inserting access data:', err);
          res.status(500).json({ message: 'Internal server error' });
        });
    });
  });
};
//navbar
exports.deleteEmployee = (req, res ) => {
  const empid = req.body.empid;

  const query1 = 'SELECT DISTINCT taskid FROM `Taskemp` WHERE AssignedTo_emp = ?';

  db.query(query1, [empid], (err, result) => {
    if (err) return res.status(500).send(err);

    const taskIds = result.map(row => row.taskid);

    const placeholders = taskIds.map(() => '?').join(',');

    db.query('SELECT * FROM `logincrd` WHERE `id` = ?', [empid], (error, results) => {
      if (error) {
        console.error('Error fetching employee: ' + error);
        return res.status(500).json({ message: 'Error fetching employee' });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: 'Employee not found' });
      }

      db.beginTransaction(error => {
        if (error) {
          console.error('Error starting transaction: ' + error);
          return res.status(500).json({ message: 'Error starting transaction' });
        }

        db.query('DELETE FROM `logincrd` WHERE `id` = ?', [empid], error => {
          if (error) {
            return db.rollback(() => {
              console.error('Error deleting employee: ' + error);
              res.status(500).json({ message: 'Error deleting employee' });
            });
          }

          // Only attempt to delete related tasks if there are task IDs
          if (taskIds.length > 0) {
            db.query(`DELETE FROM Taskemp WHERE taskid IN (${placeholders})`, taskIds, error => {
              if (error) {
                console.error('Error deleting employee tasks: ' + error);
              }

              db.query(`DELETE FROM Task WHERE id IN (${placeholders})`, taskIds, error => {
                if (error) {
                  console.error('Error deleting tasks: ' + error);
                }

                db.commit(error => {
                  if (error) {
                    return db.rollback(() => {
                      console.error('Error committing transaction: ' + error);
                      res.status(500).json({ message: 'Error committing transaction' });
                    });
                  }

                  res.status(200).json({ message: 'Success' });
                });
              });
            });
          } else {
            // Commit the transaction if there are no tasks to delete
            db.commit(error => {
              if (error) {
                return db.rollback(() => {
                  console.error('Error committing transaction: ' + error);
                  res.status(500).json({ message: 'Error committing transaction' });
                });
              }

              res.status(200).json({ message: 'Success' });
            });
          }
        });
      });
    });
  });
};

