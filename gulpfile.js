/**
* @author llisonly
* @update 2016-2-2
*/
var gulp = require('gulp'),
    stylus = require('gulp-stylus'),
    imerge = require('gulp-imerge'),
    Promise = require('bluebird'),
    rimraf = Promise.promisify(require('rimraf')),
    _ = require('lodash'),
    path = require('path'),
    uglify = require('gulp-uglify'),
    cssnano = require('gulp-cssnano'),
    connect = require('gulp-connect-php'),  
    browserSync = require('browser-sync'),
    reload = browserSync.reload,
    httpProxy = require('http-proxy'),
    documentWrite = require('gulp-document-write'),
    tap = require('gulp-tap'),
    nobone = require('nobone'),
    nocache = require('gulp-nocache');

var staticPath = './src/static',
    paths = {
        css: staticPath + '/css/**/*.@(css|styl)',
        js: staticPath + '/js/**/*.@(js|jst)',
        image: staticPath + '/image/**/*',
        sprite: staticPath + '/image/sprite/**/*.png',
        tpl: './src/view/**/*.php',
        staticDest: './dist',
        tplDest: './dist'
    },
    nocacheConf = {
        sourceContext: 'src',
        outputContext: './dist'
    };

process.env.NODE_ENV = 'development';

gulp.task('clean', function(){
    return Promise.all([
        rimraf('./dist')
    ])
});

gulp.task('build:media', ['clean'], function(){
    return gulp.src(paths.image)
        // .pipe(nocache(_.extend({
        //     type: 'media',
        //     dest: 'dist' + (process.env.NODE_ENV == 'development' ? '/[path][name].[hash:6].[ext]' : '/[path][name].[hash:8].[ext]')
        // }, nocacheConf)))
        //.pipe(gulp.dest(function(file){return file.base;}))
        .pipe(gulp.dest(paths.staticDest + '/static/image'))
});

gulp.task('build:css', ['build:media'], function(){
    var nocacheSprite = _.once(function(){
        return gulp.src(paths.sprite)
            .pipe(nocache(_.extend({
                type: 'media',
                dest: 'dist' + (process.env.NODE_ENV == 'development' ? '/[path][name].[hash:6].[ext]' : '/[path][name].[hash:8].[ext]')
            }, nocacheConf)))
            .pipe(gulp.dest(function(file){return file.base;}))
    });

    return gulp.src(paths.css)
        .pipe(stylus())
        // .pipe(imerge({
        //     spriteTo: staticPath + '/image/sprite',
        //     sourceContext: 'src',
        //     outputContext: 'src',
        //     defaults: {
        //         padding: 5
        //     }
        // }))
        // .pipe(tap(nocacheSprite))
        // .pipe(nocache(_.extend({
        //     type: 'css',
        //     dest: 'dist' + (process.env.NODE_ENV == 'development' ? '/[path][name].[hash:6].[ext]' : '/[path][name].[hash:8].[ext]')
        // }, nocacheConf)))
        .pipe(cssnano())
        //.pipe(gulp.dest(function(file){return file.base;}))
        .pipe(gulp.dest(paths.staticDest + '/static/css'))
});

gulp.task('build:js', ['build:media'], function(){
    var templateCompile = function(contents) {
        return new Buffer('define(function() {\n return ' + contents + '\n})')
    };

    return gulp.src(paths.js)
        // .pipe(tap(function(file){
        //     var extname = path.extname(file.path);

        //     if(extname === '.jst'){
        //         file.contents = templateCompile(_.template(file.contents.toString(), null).source);
        //         file.path = file.path.replace(/\.jst$/, '.js');               
        //     }
        // }))
        // .pipe(documentWrite({context: nocacheConf.sourceContext}))
        .pipe(uglify())
        // .pipe(nocache(_.extend({
        //     type: 'js',
        //     dest: 'dist' + (process.env.NODE_ENV == 'development' ? '/[path][name].[hash:6].[ext]' : '/[path][name].[hash:8].[ext]')
        // }, nocacheConf)))
        //.pipe(gulp.dest(function(file){return file.base;}))
        .pipe(gulp.dest(paths.staticDest+'/static/js'))
});

gulp.task('build:requirejs', ['build:js'], function(){    
    return gulp.src(staticPath + '/js/all.js')
        .pipe(documentWrite({ context: nocacheConf.sourceContext }))
        .pipe(tap(function(file){               
            var map = nocache.getMap(),
                newMap = {},
                sourceContext = path.resolve(nocacheConf.sourceContext),
                outputContext = path.resolve(nocacheConf.outputContext);
            _.each(map, function(value, key){                
                if (path.extname(key) === '.js'){
                    newMap[key.replace(sourceContext, '').replace(/\\/g, '/')] = nocache.utils.addCdn(value.replace(outputContext, '').replace(/\\/g, '/'), nocacheConf.cdn);
                }
            });
            var contents = file.contents.toString();
            var extraContent = 'var _HASH_MAP = ' + JSON.stringify(newMap) + ';\n';
            var load = "\n(function() { \
                var oldLoad = require.load; \
                require.load = function(context, moduleName, url) { \
                    if (window._HASH_MAP  !== undefined && _HASH_MAP[url]) { \
                        url = _HASH_MAP[url]; \
                    } \
                    return oldLoad(context, moduleName, url); \
                };\
            })();\n";
            contents = extraContent + contents + load;
            file.contents = new Buffer(contents);
        }))
        .pipe(uglify())
        .pipe(nocache(_.extend({
            type: 'js',
            dest: 'dist' + (process.env.NODE_ENV === 'development' ? '/[path][name].[hash:6].[ext]' : '/[path][name].[hash:8].[ext]')
        }, nocacheConf)))
        .pipe(gulp.dest(function(file) {return file.base;}));
});

gulp.task('build:tpl', ['build:css', 'build:js'], function(){
    return gulp.src(paths.tpl)
        .pipe(nocache(_.extend({
            type: 'tpl',
            dest: 'dist' + '/[path][name].[ext]'
        }, nocacheConf)))
        .pipe(tap(function(file){
            var contents = file.contents.toString();
            //xss filter
            contents = contents.replace(/([^\(])(\$!?\{([^\}]*?)\})(?!#\*no\*#)/g, function(nouse, start, block){
                return start + '#htmlEscape(' + block + ')';
            });
            file.contents = new Buffer(contents);
        }))
        .pipe(gulp.dest(function(file){return file.base;}))
});

gulp.task('build', ['build:media', 'build:css', 'build:js']);

// gulp.task('release', function() {  
//     // 加上cdn
//     nocacheConf.cdn = _.map(_.range(1, 10), function(i) { return 'http://static.game.ksyun.com'; });
//     gulp.start('build');
// });

var port = 8000,
    phpPort = 80;

gulp.task('server', function(){
    var nb = nobone({
        proxy: {},
        renderer: {},
        service: {}
    });

    var staticDir = process.env.NODE_ENV == 'development' ? 'src' : 'dist';

    //change js render logic, compile underscore template jst file
    nb.renderer.opts.fileHandlers['.js'] = {
        extSrc: ['.jst'],
        compiler: function(str, path, data) {
            var ret = '';
            switch (this.ext){
                case '.jst':
                    ret = _.template(str, null).source;
                    break;
                default:
            }
            return 'define(function() {\n return ' + ret + '\n})';
        }
    };

    nb.service.listen(port, function(){
        nb.kit.log('server is listening on port ' + port);
    });

    nb.service.use(nb.renderer.static(staticDir));

    nb.service.use(function(req, res){       
        if(req.originalUrl.indexOf('api')){
            nb.proxy.url(req, res, 'http://120.131.5.4:80' + req.originalUrl);
        }
    });
});

gulp.task('default', ['server'], function(){});