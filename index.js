import express from "express";
import sqlite3 from "sqlite3";
import bodyParser from "body-parser";
import session from "express-session";
import multer from "multer";

const app = express();
const port = 3000;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
});

// Session middleware setup
app.use(
  session({
    secret: "your-secret-key", // A secret key to sign the session ID cookie
    resave: false, // Don't resave the session if it's not modified
    saveUninitialized: true, // Save sessions that are not initialized
  })
);

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.redirect("/login");
  }
};

// Connect to SQLite database
const db = new sqlite3.Database("./database.db", (err) => {
  if (err) {
    console.error("Error connecting to SQLite database:", err.message);
  } else {
    console.log("Connected to SQLite database.");
  }
});

// Use body-parser middleware
app.use(bodyParser.json()); // Parse JSON data
app.use(bodyParser.urlencoded({ extended: true })); // Parse URL-encoded data
app.use(express.static("public"));
app.use('/uploads', express.static('uploads'));

db.run(
  `CREATE TABLE IF NOT EXISTS Restaurant(  
    Restaurant_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL,
    Address TEXT NOT NULL,
    Phone_Number TEXT NOT NULL,
    Opening_Hours TEXT NOT NULL,
    Email TEXT NOT NULL,
    password TEXT NOT NULL,
    PLZ INTEGER NOT NULL,
    Closing_Hours TEXT NOT NULL,
    Balance REAL DEFAULT 0,
    PLZtoDeliver TEXT,
    RestaurantImage TEXT,
    Description TEXT NOT NULL DEFAULT 'No Description Provided'
)`,
  (err) => {
    if (err) {
      console.error("Error creating table:", err);
    } else {
      console.log("Restaurant table is ready.");
    }
  }
);

db.run(
  `CREATE TABLE IF NOT EXISTS Menu_Item (
    Menu_Item_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    Restaurant_ID INTEGER NOT NULL,
    Name TEXT NOT NULL,
    Price REAL NOT NULL,
    Description TEXT NOT NULL,
    Image TEXT,
    FOREIGN KEY (Restaurant_ID) REFERENCES Restaurant(Restaurant_ID)
)`,
  (err) => {
    if (err) {
      console.error("Error creating table:", err);
    } else {
      console.log("Menu_Item table is ready.");
    }
  }
);

db.run(
  `CREATE TABLE IF NOT EXISTS User (
    User_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL,
    Email TEXT NOT NULL,
    Phone_Number TEXT NOT NULL,
    Address TEXT NOT NULL,
    password TEXT NOT NULL,
    PLZ INTEGER,
    User_Balance REAL DEFAULT 100
)`,
  (err) => {
    if (err) {
      console.error("Error creating table:", err);
    } else {
      console.log("User table is ready.");
    }
  }
);

db.run(
  `CREATE TABLE IF NOT EXISTS Orders (
        Order_ID INTEGER PRIMARY KEY AUTOINCREMENT,
        User_ID INTEGER NOT NULL,
        Restaurant_ID INTEGER NOT NULL,
        Order_Date TEXT NOT NULL,
        Items TEXT NOT NULL,
        Status TEXT DEFAULT 'In Progress',
        Notice TEXT,
        Total_Price REAL NOT NULL,
        FOREIGN KEY (User_ID) REFERENCES User(User_ID),
        FOREIGN KEY (Restaurant_ID) REFERENCES Restaurant(Restaurant_ID)
    )`,
  (err) => {
    if (err) {
      console.error("Error creating table:", err);
    } else {
      console.log("Orders table is ready.");
    }
  }
);

db.run(
  `CREATE TABLE IF NOT EXISTS platformEarnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    Balance REAL NOT NULL
    )`,
  (err) => {
    if (err) {
      console.error("Error creating table:", err);
    } else {
      console.log("platformEarnings table is ready.");
    }
  }
);

app.get("/", (req, res) => {
  res.redirect("/login");
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/contactus", (req, res) => {
  res.render("contactus.ejs");
});

app.get("/signup", (req, res) => {
  res.render("signup.ejs");
});


app.get("/restaurant/:id", isAuthenticated, (req, res) => {
  const restaurantId = req.params.id;
  const userId = req.session.userId;

  const restaurantQuery = `SELECT * FROM Restaurant WHERE Restaurant_ID = ?`;
  const userQuery = `SELECT * FROM User WHERE User_ID = ?`;
  const menuQuery = `SELECT * FROM Menu_Item WHERE Restaurant_ID = ?`;

  db.get(restaurantQuery, [restaurantId], (err, restaurant) => {
    if (err) {
      console.error("Error fetching restaurant:", err.message);
      return res.status(500).send("Error fetching restaurant.");
    }

    if (!restaurant) {
      return res.status(404).send("Restaurant not found.");
    }

    db.get(userQuery, [userId], (err, user) => {
      if (err) {
        console.error("Error fetching user data:", err.message);
        return res.status(500).send("Error fetching user data.");
      }

      if (!user) {
        return res.status(404).send("user not found.");
      }

      const userBalance = user.User_Balance;

      db.all(menuQuery, [restaurantId], (err, menuItems) => {
        if (err) {
          console.error("Error fetching menu items:", err.message);
          return res.status(500).send("Error fetching menu items.");
        }

        res.render("restraurantMenu.ejs", { user, restaurant, menuItems });
      });
    });
  });
});

app.get("/clientDashboard", isAuthenticated, (req, res) => {
  const userId = req.session.userId;

  // Fetch user details to get the PLZ
  const userQuery = `SELECT * FROM User WHERE User_ID = ?`;
  db.get(userQuery, [userId], (err, user) => {
    if (err) {
      console.error("Error fetching user data:", err.message);
      return res.status(500).send("Error fetching user data.");
    }

    const userPLZ = user.PLZ;
    const userBalance = user.User_Balance;
    const currentTime = new Date().toTimeString().split(" ")[0]; // Get current time in HH:MM:SS format

    // Fetch restaurants that are open now and deliver to the user's PLZ
    const restaurantQuery = `
      SELECT * FROM Restaurant
      WHERE Opening_Hours <= ? AND Closing_Hours >= ?
      AND PLZtoDeliver LIKE ?
    `; 

    db.all(restaurantQuery, [currentTime, currentTime, `%${userPLZ}%`], (err, restaurants) => {
      if (err) {
        console.error("Error fetching restaurants:", err.message);
        return res.status(500).send("Error fetching restaurants.");
      }
      res.render("clientDashboard.ejs", { restaurants, userBalance });
    });
  });
});

// Client orders 
app.post("/addOrder", isAuthenticated, (req, res) => {
  const { restaurandId, cart, total, Notice } = req.body;
  const userId = req.session.userId;
  const orderDate = new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" }).replace(",", "");

  if (!restaurandId || !cart || !total) {
    return res.status(400).send("All fields are required.");
  }

  const insertOrderQuery = `
    INSERT INTO Orders (User_ID, Restaurant_ID, Order_Date, Items, Total_Price, Notice)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  const updateUserBalanceQuery = `
    UPDATE User
    SET User_Balance = User_Balance - ?
    WHERE User_ID = ?
  `;

  const updatePlatformEarningsQuery = `
    INSERT INTO platformEarnings (id, Balance)
    VALUES (1, ?)
    ON CONFLICT(id) DO UPDATE SET Balance = Balance + excluded.Balance
  `;

  db.run(insertOrderQuery, [userId, restaurandId, orderDate, cart, total, Notice], function (err) {
    if (err) {
      console.error("Error inserting order:", err.message);
      return res.status(500).send("Error saving order.");
    }

    db.run(updateUserBalanceQuery, [total, userId], function (err) {
      if (err) {
        console.error("Error updating user balance:", err.message);
        return res.status(500).send("Error updating user balance.");
      }

      db.run(updatePlatformEarningsQuery, [total], function (err) {
        if (err) {
          console.error("Error updating platform earnings:", err.message);
          return res.status(500).send("Error updating platform earnings.");
        }

        console.log("Order added with ID:", this.lastID);
        res.json({ success: true }); // Send a JSON response indicating success
      });
    });
  });
});



app.get("/restaurantDashboard", isAuthenticated, (req, res) => {
  const restaurantId = req.session.userId;
  const menuQuery = `SELECT * FROM Menu_Item WHERE Restaurant_ID = ?`;
  const restaurantQuery = `SELECT * FROM Restaurant WHERE Restaurant_ID = ?`;
  const ordersQuery = `SELECT * FROM Orders WHERE Restaurant_ID = ?`;

  db.all(menuQuery, [restaurantId], (err, menuItems) => {
    if (err) {
      console.error("Error fetching menu items:", err.message);
      return res.status(500).send("Error fetching menu items.");
    }

    db.get(restaurantQuery, [restaurantId], (err, restaurant) => {
      if (err) {
        console.error("Error fetching restaurant data:", err.message);
        return res.status(500).send("Error fetching restaurant data.");
      }

      db.all(ordersQuery, [restaurantId], (err, orders) => {
        if (err) {
          console.error("Error fetching orders:", err.message);
          return res.status(500).send("Error fetching orders.");
        }

        res.render("restaurantDashboard.ejs", { menuItems, restaurant, orders });
      });
    });
  });
});
app.get("/restaurantSignup", (req, res) => {
  res.render("restaurantSignup.ejs");
});

app.get("/signout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      return res.status(500).send("Error signing out.");
    }
    res.redirect("/");
  });
});


app.post("/login", (req, res) => {
  const { email, password, accountType } = req.body;
  if (accountType !==  "User" && accountType !==  "Restaurant") {
    return res.status(401).send("Account Type is required");
  }

  let tableName = accountType === "User" ? "User" : "Restaurant";

  db.get(`SELECT * FROM ${tableName} WHERE Email = ?`, [email], (err, user) => {
    if (err) {
      return res.status(500).send("Database error.");
    }
    if (!user || user.password !== password) {
      return res.status(401).send("Invalid credentials.");
    }
    req.session.userId = accountType ===  "User" ? user.User_ID: user.Restaurant_ID; // Store user id in session
    try {
      if (accountType === "User") {
        res.redirect("/clientDashboard");
      } else {
        res.redirect("/restaurantDashboard");
      }
    } catch (compareError) {
      console.error("Error comparing passwords:", compareError);
      res.status(500).send("Internal server error.");
    }
  });
});

app.delete("/delete-item/:id", isAuthenticated, (req, res) => {
  const restaurantId = req.session.userId;
  const itemId = req.params.id;

  const query = `DELETE FROM Menu_Item WHERE Menu_Item_ID = ? AND Restaurant_ID = ?`;
  db.run(query, [itemId, restaurantId], function (err) {
    if (err) {
      console.error("Error deleting menu item:", err.message);
      return res.status(500).send("Error deleting menu item.");
    }

    console.log("Menu item deleted with ID:", itemId);
    res.sendStatus(204);
  });
});

app.post("/add-item", isAuthenticated, upload.single("AddNewItemImage"), async (req, res) => {
  const { itemName, itemPrice, description } = req.body;
  const image = req.file ? req.file.filename : 'defaultItem.webp';
  const restaurantId = req.session.userId; 

  if (!itemName || !itemPrice || !description) {
    return res.status(400).send("All fields are required.");
  }

  const query = `
    INSERT INTO Menu_Item (Restaurant_ID, Name, Price, Description, Image)
    VALUES (?, ?, ?, ?, ?)
  `;
  db.run(query, [restaurantId, itemName, itemPrice, description, image], function (err) {
    if (err) {
      console.error("Error inserting menu item:", err.message);
      return res.status(500).send("Error saving menu item.");
    }

    console.log("Menu item added with ID:", this.lastID);
    res.redirect("/restaurantDashboard"); // Redirect to the restaurant dashboard or another page
  });
});

app.get("/get-item/:id", isAuthenticated, (req, res) => {
  const itemId = req.params.id;
  const query = `SELECT * FROM Menu_Item WHERE Menu_Item_ID = ?`;

  db.get(query, [itemId], (err, item) => {
    if (err) {
      console.error("Error fetching menu item:", err.message);
      return res.status(500).send("Error fetching menu item.");
    }

    res.json(item);
  });
});

app.post("/edit-item", isAuthenticated, upload.single("EditItemImage"), (req, res) => {
  const { itemId, itemName, itemPrice, description } = req.body;
  const image = req.file ? req.file.filename : null;

  if (!itemName || !itemPrice || !description ) {
    return res.status(400).send("All fields are required.");
  }

  if (!itemId) {
    return res.status(400).send("Error from the server, Item Id is missed.");
  }


  const query = `
    UPDATE Menu_Item
    SET Name = ?, Price = ?, Description = ?, Image = ?
    WHERE Menu_Item_ID = ?
  `;
  db.run(query, [itemName, itemPrice, description, image, itemId], function (err) {
    if (err) {
      console.error("Error updating menu item:", err.message);
      return res.status(500).send("Error updating menu item.");
    }

    console.log("Menu item updated with ID:", itemId);
    res.redirect("/restaurantDashboard"); // Redirect to the restaurant dashboard or another page
  });
});


//Orders Confirmation

app.post("/confirmOrder", isAuthenticated, (req, res) => {
  const { orderId } = req.body;

  db.get("SELECT * FROM Orders WHERE Order_ID = ?", [orderId], (err, order) => {
    if (err || !order) {
      console.error("Error fetching order:", err);
      return res.status(500).json({
        success: false,
        message: "An error occurred while fetching the order.",
      });
    }

    const restaurantShare = parseFloat((order.Total_Price * 0.85).toFixed(2));

    db.serialize(() => {
      // Deduct 85% from platformEarnings
      db.run(
        "UPDATE platformEarnings SET Balance = ROUND(Balance - ?, 2) WHERE id = 1",
        [restaurantShare],
        (err) => {
          if (err) {
            console.error("Error updating platformEarnings balance:", err);
            return res.status(500).json({
              success: false,
              message: "An error occurred while updating platformEarnings balance.",
            });
          }
        }
      );

      // Add 85% to restaurant's balance
      db.run(
        "UPDATE Restaurant SET Balance = ROUND(Balance + ?, 2) WHERE Restaurant_ID = ?",
        [restaurantShare, order.Restaurant_ID],
        (err) => {
          if (err) {
            console.error("Error updating restaurant balance:", err);
            return res.status(500).json({
              success: false,
              message: "An error occurred while updating restaurant balance.",
            });
          }

          // Update order status
          db.run(
            "UPDATE Orders SET Status = ? WHERE Order_ID = ?",
            ["Confirmed", orderId],
            (err) => {
              if (err) {
                console.error("Error updating order status:", err);
                return res.status(500).json({
                  success: false,
                  message: "An error occurred while updating the order status.",
                });
              }

              res.json({
                success: true,
                message: "Order confirmed successfully!",
              });
            }
          );
        }
      );
    });
  });
});

//Orders Refuse

app.post("/refuseOrder", isAuthenticated, (req, res) => {
  const { orderId } = req.body;

  db.get("SELECT * FROM Orders WHERE Order_ID = ?", [orderId], (err, order) => {
    if (err || !order) {
      console.error("Error fetching order:", err);
      return res.status(500).json({
        success: false,
        message: "An error occurred while fetching the order.",
      });
    }

    db.serialize(() => {
      // Refund the total price to the user
      db.run(
        "UPDATE User SET User_Balance = User_Balance + ? WHERE User_ID = ?",
        [order.Total_Price.toFixed(2), order.User_ID],
        (err) => {
          if (err) {
            console.error("Error updating user balance:", err);
            return res.status(500).json({
              success: false,
              message: "An error occurred while refunding the user.",
            });
          }

          // Update order status
          db.run(
            "UPDATE Orders SET Status = ? WHERE Order_ID = ?",
            ["Refused", orderId],
            (err) => {
              if (err) {
                console.error("Error updating order status:", err);
                return res.status(500).json({
                  success: false,
                  message: "An error occurred while updating the order status.",
                });
              }

              res.json({
                success: true,
                message: "Order refused and refunded successfully!",
              });
            }
          );
        }
      );
    });
  });
});









  // PLZ adding to deliver

app.post("/add-plz", isAuthenticated, (req, res) => {
  const { plz } = req.body;
  const userId = req.session.userId;

  if (!plz) {
    return res.status(400).send("PLZ is required.");
  }

  const query = `
    UPDATE Restaurant
    SET PLZtoDeliver = PLZtoDeliver || ?
    WHERE Restaurant_ID = ?
  `;

  db.run(query, [plz, userId], function (err) {
    if (err) {
      console.error("Error updating PLZ:", err.message);
      return res.status(500).send("Error updating PLZ.");
    }

    console.log("PLZ updated for user with ID:", userId);
    res.json({ success: true });
  });
});

app.post("/signUpUser", async (req, res) => {
  console.log(req.body); // Debugging
  const { Name, Address, PLZ, Email, Phone_Number, password } = req.body;

  if (!Name || !Email || !Phone_Number || !Address || !password || !PLZ) {
    return res.status(400).send("All fields are required.");
  }

  try {
    // Hash the password
    // const hashedPassword = await bcrypt.hash(password, 10);

    // Insert the user into the database
    const query = `
      INSERT INTO User (Name, Email, Phone_Number, Address, password, PLZ, User_Balance)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    db.run(
      query,
      [Name, Email, Phone_Number, Address, password, PLZ, 100],
      function (err) {
        if (err) {
          console.error("Error inserting user:", err.message);
          return res.status(500).send("Error saving user.");
        }

        console.log("User registered with ID:", this.lastID);
        res.render("user-dashboard.ejs"); // Redirect to home or another page
      }
    );
  } catch (err) {
    console.error("Error processing signup:", err.message);
    res.status(500).send("Internal server error.");
  }
});

app.post("/signUpRestaurant",upload.single("RestaurantImage"), async (req, res) => {
  console.log(req.body); // Debugging

  const {
    restaurantName,
    phoneNumber,
    email,
    password,
    address,
    plz,
    openingHours,
    closingHours,
    Description
  } = req.body;

  const image = req.file ? req.file.filename : 'defaultRestaurant.webp';

  if (
    !restaurantName ||
    !phoneNumber ||
    !email ||
    !password ||
    !address ||
    !plz ||
    !openingHours ||
    !closingHours ||
    !Description
  ) {
    return res.status(400).send("All fields are required.");
  }

  try {
    // Insert the user into the database
    const query = `
      INSERT INTO Restaurant (Name, Address, Phone_Number, Opening_Hours, Email, password, PLZ, Closing_Hours, PLZtoDeliver , RestaurantImage , Description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.run(
      query,
      [
        restaurantName,
        address,
        phoneNumber,
        openingHours,
        email,
        password,
        plz,
        closingHours,
        plz + ",",
        image,
        Description
      ],
      function (err) {
        if (err) {
          console.error("Error inserting user:", err.message);
          return res.status(500).send("Error saving user.");
        }

        console.log("Restaurant registered with ID:", this.lastID);
        res.redirect("/restaurantDashboard"); // Redirect to home or another page
      }
    );
  } catch (err) {
    console.error("Error processing signup:", err.message);
    res.status(500).send("Internal server error.");
  }
});

app.listen(port, () => {
  console.log(`Server running on port http://localhost:${port}`);
});
