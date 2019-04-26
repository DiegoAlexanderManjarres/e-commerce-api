require('dotenv/config')

const mongoose = require('mongoose')
const session = require('express-session')
const MongoDBStore = require('connect-mongodb-session')(session)
const helmet = require('helmet')
const { GraphQLServer } = require('graphql-yoga')

const { authenticate } = require('./middlewares/auth')
const Mutation = require('./graphql/resolvers/Mutation')
const Query = require('./graphql/resolvers/Query')



// database session
const store = new MongoDBStore({ uri: process.env.DB, collection: 'sessions' })
store.on('error', error => console.error('store session error:', error))


// graphql server config
const server = new GraphQLServer({ 
   typeDefs: './graphql/schema.graphql', 
   resolvers: { Mutation, Query },
   context: req => ({ req: req.request })
})
 

// set headers
server.express.use((req, res, next) => {
   res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
   next()
})


// helmetjs security
server.express.use(helmet({ 
   permittedCrossDomainPolicies: { permittedPolicies: 'none' } 
}))



// Configure SESSION
server.express.use(session({ 
   name: 'sqid',
   secret: process.env.SECRET,
   resave: false,
   secure: process.env.NODE_ENV === 'production', // setup needed
   saveUninitialized: false,
   cookie: { maxAge: ((60 * 60) * 24) * 1000 },
   store
}))


// authenticate middleware
server.express.use(authenticate)


const serverOptions = {
   port: process.env.PORT || 4000,
   cors: { credentials: true, origin: ['http://localhost:3000'] },
   uploads: { maxFileSize: 1000000 },
   formatError: error => {      
      console.error('.......................\n', error,'\n........................')
      if (!error.originalError) { return error }
      return { message: error.message, locations: error.locations, path: error.path }      
   }
}


// connect to database
mongoose.connect(process.env.DB, { useNewUrlParser: true })
   .then(result => server.start(serverOptions, () => console.log('Server up')))
   .catch(err => console.error(err))




