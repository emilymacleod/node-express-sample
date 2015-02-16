var assert = require('assert');
var request = require('supertest');

var app = require('../index');
var pg = require('../lib/postgres');
var DATABASE_URL = 'postgres://emilymacleod@localhost/api'
describe('Tutorial REST API', function() {
before(function(done) {
    pg.initialize(DATABASE_URL, done);
  });
	
  describe('Create photo', function() {
    it('returns the created resource on success', function(done) {
    	var validPhotoResource = {
    description: 'Photo created on ',
    filepath: '/path/to/photo.jpg',
    album_id: 1
  };
  request(app)
    .post('/photo')
    .field('description', validPhotoResource.description)
    .field('album_id', validPhotoResource.album_id)
    .attach('photo', __dirname + '/speakeasy.png') 
    .expect(201)
    .end(function(err, res) {
      if (err) {
        return done(err);
      }
      assert.equal(res.body.description, validPhotoResource.description);
      assert.equal(res.body.album_id, validPhotoResource.album_id);
      assert.ok(res.body.id);
      done();
    });
});

    });
   /* it('returns 400, with error message on bad request', function(done) {
    });*/
});