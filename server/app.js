'use strict';

var express = require('express'),
    http = require('http'),
    spawn = require('child_process').spawn,
    path = require('path'),
    request = require('request'),
    uuid = require('node-uuid'),
    fs = require('fs');

/* ----------------------------------------------------------------------------
 * Webserver setup
 * --------------------------------------------------------------------------*/

var app = express(),
    appRoot = __dirname;

app.set('port', process.env.PORT || 7654);

// CORS middleware
var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    next();
}
app.use(allowCrossDomain);

http.createServer(app).listen(app.get('port'), function() {
    console.log('[App] Express app started on port: ' + app.get('port'));
});

app.get('/applications', function(req, res) {
    console.log('GET /applications');

    res.json({
        apps: [{
            name: 'Registration Prototype'
        }]
    })
});

// var host = 'http://localhost:9000';
var host = 'http://bw-dssv18.bwk.tue.nl:9000'

app.put('/applications/:id', function(req, res) {
    var urlparse = require('url');
    var url_parts = urlparse.parse(req.url, true);
    var params = url_parts.query;

    // console.log('req.url: ' + req.url);
    // console.log('QUERY: ' + JSON.stringify(params));
    // return;

    var id = params['id'],
        file0 = params['inputfile0'],
        file1 = params['inputfile1'],
        session_id = params['session_id'],
        session_uuid = uuid.v4();

    // FIXXME: something is weird here...
    session_id = session_id.split('/')[0];

    // console.log('Incoming request to start app #' + id);
    // console.log('     file0: ' + file0);
    // console.log('     file1: ' + file1);

    var req_url = host + '/download/' + session_id + '/' + file0;
    console.log('REQUESTING from download service:' + req_url);

    var target0 = path.join(appRoot, '..', 'downloads', session_uuid, file0);
    var target_dir = path.join(appRoot, '..', 'downloads', session_uuid);

    // FIXXME: this is not totally save regarding timing issues, but will do...
    fs.mkdir(target_dir, function(err) {
        if (err) {
            console.log('mkdir ERR: ' + err);
        }
    });

    var file_stream = fs.createWriteStream(target0);
    request(req_url).pipe(file_stream);

    file_stream.on('close', function() {
        console.log('Finished download of: ' + target0);

        req_url = host + '/download/' + session_id + '/' + file1;

        var target1 = path.join(appRoot, '..', 'downloads', session_uuid, file1);
        file_stream = fs.createWriteStream(target1);
        request(req_url).pipe(file_stream);

        file_stream.on('close', function() {
            console.log('Finished download of: ' + target1);

            // file0 = path.join(appRoot, '..', 'apps', 'Software_Prototype_D441_D551-E57', 'ExampleE57', 'Rislokka_subsampled_small_5x5.e57');
            // file1 = path.join(appRoot, '..', 'apps', 'Software_Prototype_D441_D551-E57', 'ExampleE57', 'Rislokka_subsampled_small_10x10.e57');

            var exec_path = path.join(appRoot, '..', 'apps', 'Software_Prototype_D441_D551-E57', 'bin', 'graphene.exe'),
                options = ['--single', 'Registration', '--no-effects', '--file', target0, '--file', target1];

            var current_cwd = process.cwd(),
                app_root = path.dirname(exec_path);

            process.chdir(app_root);
            console.log('Changing to dir: ' + app_root);
            console.log('About to spawn: ' + path.basename(exec_path) + ' ' + options.join(' '));
            var executable = spawn(exec_path, options);

            executable.stdout.on('data', function(data) {
                console.log('OUT: ' + data);
            });

            executable.stderr.on('data', function(data) {
                console.log('ERROR: ' + data);
            });

            executable.on('close', function(code) {
                console.log('CLOSE, exit code: ' + code);
                if (code === 0) {
                    res.json({
                        app: [{
                            status: 'Finished'
                        }]
                    })
                } else {
                    res.json({
                        app: [{
                            status: 'Error'
                        }]
                    })
                }
            });
        });
    });
});