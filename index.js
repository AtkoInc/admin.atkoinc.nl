require('dotenv').config()
require('https').globalAgent.options.rejectUnauthorized = false;
const express = require('express')
const hbs  = require('express-handlebars')
const session = require('express-session')
const axios = require('axios')
const bodyParser = require('body-parser')
const flash = require('connect-flash')
const urlencodedParser = bodyParser.urlencoded({ extended: true });

var passport = require('passport');
var logger = require('./logger')

const tenantResolver = require('./tenantResolver')
const userProfile = require('./models/userprofile')

const PORT = process.env.PORT || 3000;

app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(flash());

app.engine('hbs',  hbs( { 
    extname: 'hbs', 
    defaultLayout: 'main', 
    layoutsDir: __dirname + '/views/layouts/',
    partialsDir: __dirname + '/views/partials/',
    helpers: {
        ifEquals: (arg1, arg2, options) => {
            return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
        },
        jwt: function (token){
            var atob = require('atob');
            if (token != null) {
                var base64Url = token.split('.')[1];
                var base64 = base64Url.replace('-', '+').replace('_', '/');
                return JSON.stringify(JSON.parse(atob(base64)), undefined, '\t');
            } else {
                return "Invalid or empty token was parsed"
            }
        },
        'select': function(selected, options) {
            return options.fn(this).replace(
                new RegExp(' value=\"' + selected + '\"'),
                '$& selected="selected"');
        }
    }
  } ) );

app.set('view engine', 'hbs');

app.use('/assets', express.static('assets'));
app.use('/scripts', express.static(__dirname + '/node_modules/clipboard/dist/'));

app.use(session({
  cookie: { httpOnly: true },
  secret: process.env.SESSION_SECRET,
  saveUninitialized: false,
  resave: true
}));

app.use(passport.initialize({ userProperty: 'userContext' }));
app.use(passport.session());

passport.serializeUser((user, next) => {
    next(null, user);
  });
  
  passport.deserializeUser((obj, next) => {
    next(null, obj);
  });

  const tr = new tenantResolver();

function parseJWT (token){
    var atob = require('atob');
    if (token != null) {
        var base64Url = token.split('.')[1];
        var base64 = base64Url.replace('-', '+').replace('_', '/');
        return JSON.parse(atob(base64))
    } else {
        return "Invalid or empty token was parsed"
    }
}

function parseError(error){
    try{
        if(error.response.status === 403 && error.response.headers['www-authenticate']){
            var error_description_pattern = /.*error_description=\"([^\"]+)\",.*/
            var scope_pattern = /.*scope=\"([^\"]+)\".+/
            var des = error.response.headers['www-authenticate'].match(error_description_pattern)[1]
            var scopeRequired = error.response.headers['www-authenticate'].match(scope_pattern)[1]
            return des+ " Required Scope: "+scopeRequired
        } 

        if(error.response.data.errorSummary){
            return error.response.data.errorSummary
        }
        if (error.response.data.error_description){
        return error.response.data.error_description
        }
        else {
            logger.error(error)
            return "Unable to parse error cause. Check console."
        }
    } catch(error){
        return "Unable to parse error cause. Check console."
    }
}

const router = express.Router();

router.get('/', function(req, res, next) {
  res.redirect("/home");
    //res.render('index', {layout: 'home', template: 'home'});
});

router.get("/home",tr.ensureAuthenticated(), async (req, res, next) => {
    logger.verbose("/home requested");
    const tokenSet = req.userContext.tokens;
    axios.defaults.headers.common['Authorization'] = `Bearer `+tokenSet.access_token
    try {
        const response = await axios.get(tr.getRequestingTenant(req).tenant+'/api/v1/users/me')
        var profile = new userProfile(response.data)
        res.render("home",{
            layout: 'main',
            tenant: tr.getRequestingTenant(req).tenant,
            tokenSet: req.userContext.tokens,
            user: profile,
        });
    }
    catch(error) {
        res.render("home",{
            layout: 'main',
            tenant: tr.getRequestingTenant(req).tenant,
            tokenSet: req.userContext.tokens,
            user: new userProfile(),
            error: parseError(error)
        });
    }
});

router.get("/users",tr.ensureAuthenticated(), async (req, res, next) => {
    logger.verbose("/users requested");
    const tokenSet = req.userContext.tokens;
    axios.defaults.headers.common['Authorization'] = `Bearer `+tokenSet.access_token
    try {
        const currentUser = await axios.get(tr.getRequestingTenant(req).tenant+'/api/v1/users/me')
        var profile = new userProfile(currentUser.data);

        //build search conditionals always including organization
        var search = 'profile.organization eq "'+profile.organization+'"'
        
        var response = await axios.get(tr.getRequestingTenant(req).tenant+'/api/v1/users?search=' + encodeURI(search));
        var userCollection = []
        for(var user in response.data){
            userCollection.push(new userProfile(response.data[user]))  
        }

        res.render("users",{
            layout: 'main',
            organization: profile.organization,
            users: userCollection,
            tenant: tr.getRequestingTenant(req).tenant,
            tokenSet: req.userContext.tokens,
            user: profile,
            flash: req.flash('msg')
        });
    }
    catch(error) {
        res.render("users",{
            layout: 'main',
            tenant: tr.getRequestingTenant(req).tenant,
            tokenSet: req.userContext.tokens,
            user: new userProfile(),
            error: parseError(error)
        });
    }
});

router.post("/update_user",[tr.ensureAuthenticated(), urlencodedParser], async (req, res, next) => {
    logger.verbose("/update_user requested");
    const tokenSet = req.userContext.tokens;
    axios.defaults.headers.common['Authorization'] = `Bearer `+tokenSet.access_token
    try {
        var user = {
            profile: {
                firstName: req.body.first_name,
                lastName: req.body.last_name
            }
        };

        await axios.post(tr.getRequestingTenant(req).tenant+'/api/v1/users/' + req.body.id, user);

        req.flash('msg', 'User has been updated.');
        res.redirect('/users');
    }
    catch(error) {
        res.render("users",{
            layout: 'main',
            tenant: tr.getRequestingTenant(req).tenant,
            tokenSet: req.userContext.tokens,
            user: new userProfile(),
            error: error
        });
    }
});

router.get("/user",tr.ensureAuthenticated(), async (req, res, next) => {
    logger.verbose("/user requested");
    const tokenSet = req.userContext.tokens;
    axios.defaults.headers.common['Authorization'] = `Bearer `+tokenSet.access_token
    try {
        var sub = req.query.id;
        
        const response = await axios.get(tr.getRequestingTenant(req).tenant+'/api/v1/users/'+sub)
        var profile = new userProfile(response.data);

        var creatorObj_response = await axios.get(
            tr.getRequestingTenant(req).tenant+'/api/v1/users/' + sub + 
            "/linkedObjects/account_creator");
        if(creatorObj_response.data.length > 0){
            var creator_response = await axios.get(creatorObj_response.data[0]._links.self.href);
            profile.setAccountCreator(creator_response.data)
        }

        var ownerObj_response = await axios.get(
            tr.getRequestingTenant(req).tenant+'/api/v1/users/' + sub + 
            "/linkedObjects/account_owner")
        if(ownerObj_response.data.length > 0){
            var ownerResponse = await axios.get(ownerObj_response.data[0]._links.self.href);
            profile.setAccountOwner(ownerResponse.data)
        }

        res.render("user_edit",{
            layout: 'main',
            tenant: tr.getRequestingTenant(req).tenant,
            tokenSet: req.userContext.tokens,
            user: profile,
        });
    }
    catch(error) {
        res.render("users",{
            layout: 'main',
            tenant: tr.getRequestingTenant(req).tenant,
            tokenSet: req.userContext.tokens,
            user: new userProfile(),
            error: parseError(error)
        });
    }
});

router.post("/invite_user",[tr.ensureAuthenticated(), urlencodedParser], async (req, res, next) => {
    logger.verbose("/invite_user requested");
    const tokenSet = req.userContext.tokens;
    axios.defaults.headers.common['Authorization'] = `Bearer `+tokenSet.access_token
    try {
        var groups = []
        var url = tr.getRequestingTenant(req).tenant+'/api/v1/users/'+req.userContext.userinfo.sub+"/groups";
        var response = await axios.get(tr.getRequestingTenant(req).tenant+'/api/v1/users/'+req.userContext.userinfo.sub+"/groups");
        for( var group in response.data) {
            if(response.data[group].profile.name.startsWith("Partner:")){
              groups.push(response.data[group].id)
            }
        }

        var newUser = {
            profile: { 
                firstName: req.body.first_name,
                lastName: req.body.last_name,
                organization: req.body.organization,
                email: req.body.email,
                login: req.body.email,
                account_federated: false
            },
            groupIds: groups
        };
        var response = await axios.post(tr.getRequestingTenant(req).tenant+'/api/v1/users', newUser);
        var id = response.data.id

        //link the object to its creator
        var response = await axios.put(
          tr.getRequestingTenant(req).tenant+'/api/v1/users/' +
          id + '/linkedObjects/account_creator/' +
          req.userContext.userinfo.sub);

        var response = await axios.put(
            tr.getRequestingTenant(req).tenant+ '/api/v1/users/' +
            id + '/linkedObjects/account_owner/' +
            req.userContext.userinfo.sub);


        req.flash('msg', 'An invitation has been sent to ' + req.body.email);
        res.redirect('/users');
    }
    catch(error) {
        res.render("invite_user",{
            layout: 'main',
            tenant: tr.getRequestingTenant(req).tenant,
            tokenSet: req.userContext.tokens,
            user: new userProfile(),
            error: error
        });
    }
});

router.get("/invite_user",tr.ensureAuthenticated(), async (req, res, next) => {
    logger.verbose("/invite_user requested");
    const tokenSet = req.userContext.tokens;
    axios.defaults.headers.common['Authorization'] = `Bearer `+tokenSet.access_token
    try {
        const currentUser = await axios.get(tr.getRequestingTenant(req).tenant+'/api/v1/users/me/')
        var profile = new userProfile(currentUser.data);
        
        res.render("invite_user",{
            layout: 'main',
            organization: profile.organization,
            tenant: tr.getRequestingTenant(req).tenant,
            tokenSet: req.userContext.tokens,
            user: profile
        });
    }
    catch(error) {
        res.render("users",{
            layout: 'main',
            tenant: tr.getRequestingTenant(req).tenant,
            tokenSet: req.userContext.tokens,
            user: new userProfile(),
            error: parseError(error)
        });
    }
});

router.get("/logout", tr.ensureAuthenticated(), (req, res) => {
    logger.verbose("/logout requsted")
    let protocol = "http"
    if(req.secure){
        logger.verbose("Request was secure")
        protocol = "https"
    }
    else if(req.get('x-forwarded-proto')){
        protocol = req.get('x-forwarded-proto').split(",")[0]
        logger.verbose("Request had forwarded protocol "+protocol)
    }
    const tenant = tr.getRequestingTenant(req).tenant
    const tokenSet = req.userContext.tokens;
    const id_token_hint = tokenSet.id_token
    req.logout();
    req.session.destroy();
    res.redirect(tenant+'/oauth2/v1/logout?id_token_hint='
        + id_token_hint
        + '&post_logout_redirect_uri='
        + encodeURI(protocol+"://"+req.headers.host)
        );
});

var delegateRouter = require('./routes/delegation')(tr)
app.use('/delegate', delegateRouter)

router.get("/error",async (req, res, next) => {
    res.render("error",{
        msg: "An error occured, unable to process your request."
       });
});

app.use(router)  

app.listen(PORT, () => logger.info('app started'));