var express = require('express');
var ejs = require('ejs');
var bodyParser = require('body-parser');
var expressValidator = require('express-validator');
var multer = require('multer');
var app = express();
app.use(bodyParser.json({ type: 'application/json' }));
app.use(expressValidator());
var postgres = require('./lib/postgres');
var photoRouter = express.Router();
var uploadRouter = express.Router();
app.set('views', './views');
app.set('view engine', 'ejs');
uploadRouter.get('/', function(req, res) {
  res.render('form.ejs');
});
app.use('/upload', uploadRouter);
photoRouter.get('/', function(req, res){
  console.log("got to photo route");
  var page = parseInt(req.query.page, 10);
  if (isNaN(page) || page < 1) {
    page = 1;
  }
  var limit = parseInt(req.query.limit, 10);
  if (isNaN(limit)) {
    limit = 30;
  } else if (limit > 50) {
    limit = 50;
  } else if (limit < 1) {
    limit = 1;
  }
  var sql = 'SELECT count(1) FROM photo';
    postgres.client.query(sql, function(err, result) {
      var count = parseInt(result.rows[0].count, 10);
      console.log(err);
       var offset = (page - 1) * limit;
    console.log("found the count");
    var sql = 'SELECT * FROM photo OFFSET $1 LIMIT $2';
    postgres.client.query(sql, [offset, limit], function(err, result) {
      console.log(err)
      console.log("done");
      res.json(result.rows);
    });
    });
   
})

photoRouter.post('/', multer({
  dest: './uploads/',
  rename: function(field, filename) {
    filename = filename.replace(/\W+/g, '-').toLowerCase();
    return filename + '_' + Date.now();
  },
  limits: {
    files: 1,
    fileSize: 2 * 1024 * 1024 // 2mb, in bytes
  }
}), 
validatePhoto, function(req, res) { 

  var sql = 'INSERT INTO photo (description, filepath, album_id) VALUES ($1,$2,$3) RETURNING id';
  console.log(req.body);
  // Retrieve the data to insert from the POST body
  var data = [
    req.body.description,
    req.files.photo.path,
    req.body.album_id
  ];
  postgres.client.query(sql, data, function(err, result) {
    if (err) {
      // We shield our clients from internal errors, but log them
      console.error(err);
      res.statusCode = 500;
      return res.json({
        errors: ['Failed to create photo']
      });
    }
    var newPhotoId = result.rows[0].id;

    

    var sql = 'SELECT * FROM photo WHERE id = $1';
    postgres.client.query(sql, [ newPhotoId ], function(err, result) {
      if (err) {
        // We shield our clients from internal errors, but log them
        console.error(err);
        res.statusCode = 500;
        return res.json({
          errors: ['Could not retrieve photo after create']
        });
      }
      // The request created a new resource object
      res.statusCode = 201;
      // The result of CREATE should be the same as GET
      res.json(result.rows[0]);
    });
  });
});

photoRouter.get('/:id([0-9]+)', lookupPhoto, function(req, res) { 
res.json(req.photo);
})

photoRouter.patch('/:id', lookupPhoto, function(req, res) { });
photoRouter.delete('/:id', lookupPhoto, function(req, res) { });
app.get('/photo/:id', lookupPhoto, function(req, res) { });
app.use('/photo', photoRouter);

var albumRouter = express.Router();
albumRouter.get('/', function(req, res) { });
albumRouter.post('/', function(req, res) { });
albumRouter.get('/:id', function(req, res) { });
albumRouter.patch('/:id', function(req, res) { });
albumRouter.delete('/:id', function(req, res) { });
app.use('/album', albumRouter);

module.exports = app;

function lookupPhoto(req, res, next) {
  // We access the ID param on the request object
  var photoId = req.params.id;
  // Build an SQL query to select the resource object by ID
  var sql = 'SELECT * FROM photo WHERE id = $1';
  postgres.client.query(sql, [ photoId ], function(err, results) {
    if (err) {
      console.error(err);
      res.statusCode = 500;
      return res.json({ errors: ['Could not retrieve photo'] });
    }
    // No results returned mean the object is not found
    if (results.rows.length === 0) {
      // We are able to set the HTTP status code on the res object
      res.statusCode = 404;
      return res.json({ errors: ['Photo not found'] });
    }
    // By attaching a Photo property to the request
    // Its data is now made available in our handler function
    req.photo = results.rows[0];
    next();
  });
}

function validatePhoto(req, res, next) {
console.log("this ran", req.files);
  if (!req.files.photo) {
    console.log("this didn't work");
    return res.json({
      errors: ['File failed to upload']
    });
  }
  if (req.files.photo.truncated) {
    console.log("too big");
    return res.json({
      errors: ['File too large']
    });
  }

  req.checkBody('description', 'Invalid description').notEmpty();
  req.checkBody('album_id', 'Invalid album_id').isNumeric();
  var errors = req.validationErrors();
  if (errors) {
    var response = { errors: [] };
    errors.forEach(function(err) {
      response.errors.push(err.msg);
    });
    res.statusCode = 400;
    return res.json(response);
  }
  return next();
 }