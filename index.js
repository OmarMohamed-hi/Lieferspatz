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
    res.render("login.ejs");
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
    PLZtoDeliver TEXT 
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
  `CREATE TABLE IF NOT EXISTS Order_History (
    Order_History_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    User_ID INTEGER NOT NULL,
    Order_ID INTEGER NOT NULL,
    Restaurant_ID INTEGER NOT NULL,
    Order_Date TEXT NOT NULL,
    Total_Amount REAL NOT NULL,
    Order_Status TEXT NOT NULL,
    FOREIGN KEY (User_ID) REFERENCES User(User_ID),
    FOREIGN KEY (Order_ID) REFERENCES Orders(Order_ID),
    FOREIGN KEY (Restaurant_ID) REFERENCES Restaurant(Restaurant_ID)
    )`,
  (err) => {
    if (err) {
      console.error("Error creating table:", err);
    } else {
      console.log("Order_History table is ready.");
    }
  }
);

db.run(
  `CREATE TABLE IF NOT EXISTS Orders (
        Order_ID INTEGER PRIMARY KEY AUTOINCREMENT,
        User_ID INTEGER NOT NULL,
        Restaurant_ID INTEGER NOT NULL,
        Order_Date TEXT NOT NULL,
        Delivery_Status TEXT NOT NULL,
        Total_Amount REAL NOT NULL,
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
  `CREATE TABLE IF NOT EXISTS Order_Item (
      Order_Item_ID INTEGER PRIMARY KEY AUTOINCREMENT,
      Order_ID INTEGER NOT NULL,
      Menu_Item_ID INTEGER NOT NULL,
      Quantity INTEGER NOT NULL,
      Price REAL NOT NULL,
      FOREIGN KEY (Order_ID) REFERENCES Orders(Order_ID),
      FOREIGN KEY (Menu_Item_ID) REFERENCES Menu_Item(Menu_Item_ID)
      )`,
  (err) => {
    if (err) {
      console.error("Error creating table:", err);
    } else {
      console.log("Order_Item table is ready.");
    }
  }
);

db.run(
  `CREATE TABLE IF NOT EXISTS Payment (
    Payment_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    Order_ID INTEGER NOT NULL,
    Payment_Method TEXT NOT NULL,
    Payment_Status TEXT NOT NULL,
    Payment_Date TEXT NOT NULL,
    FOREIGN KEY (Order_ID) REFERENCES Orders(Order_ID)
    )`,
  (err) => {
    if (err) {
      console.error("Error creating table:", err);
    } else {
      console.log("Payment table is ready.");
    }
  }
);

app.get("/", (req, res) => {
  res.redirect("/login");
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

// app.get("/nearby", (req, res) => {
//   res.render("nearby.ejs");
// });

app.get("/contactus", (req, res) => {
  res.render("contactus.ejs");
});

app.get("/signup", (req, res) => {
  res.render("signup.ejs");
});

app.get("/menu", (req, res) => {
  res.render("rest.ejs");
});

app.get("/checkout", (req, res) => {
  res.render("checkout.ejs");
});

app.get("/clientDashboard", (req, res) => {
  res.render("clientDashboard.ejs");
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




app.post("/add-item", upload.single("AddNewItemImage"), async (req, res) => {
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

app.get("/get-item/:id", (req, res) => {
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

app.post("/edit-item", upload.single("EditItemImage"), (req, res) => {
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

// orders paths

//
//
//
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








app.post("/save", async (req, res) => {
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

app.post("/saveRestaurant", async (req, res) => {
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
  } = req.body;

  if (
    !restaurantName ||
    !phoneNumber ||
    !email ||
    !password ||
    !address ||
    !plz ||
    !openingHours ||
    !closingHours
  ) {
    return res.status(400).send("All fields are required.");
  }

  try {
    // Hash the password
    // const hashedPassword = await bcrypt.hash(password, 10);

    // Insert the user into the database
    const query = `
      INSERT INTO Restaurant (Name, Address, Phone_Number, Opening_Hours, Email, password, PLZ, Closing_Hours, PLZtoDeliver)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
  console.log(`Server running on port ${port}`);
});
