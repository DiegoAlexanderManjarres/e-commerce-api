const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const uniqid = require('uniqid')

const Product = require('../../models/productSchema')
const User = require('../../models/userSchema')
const { getAuthorizedUserId } = require('../../middlewares/auth')
const {  processUploads, deleteImages } = require('../../utils/imageFsHandler')
const { imagesToCloud }  = require('../../utils/cloudinaryConfig')
const { 
   addProductValidation, 
   loginValidation,
   registerValidation 
} = require('../../middlewares/validation/validation')



const sessionSave = async (context, loggedText) => {
   const errors = []
   await context.req.session.save(err => { 
      if (err) { errors.push(err) }
      if (loggedText) { loggedText() }
   })
   if (errors.length > 0) { throw errors[0] }
}


const _cartSubtotal = async (userCart, context) => {
   const sessionType = context.req.isAuth ? 'user' : 'guest'

   const cartSubtotal =  userCart.products
      .reduce((a, b) => a + (b.product.price * b.quantity), 0)  

   userCart.subtotal = Number((cartSubtotal * 100 / 100).toFixed(2))

   context.req.session[sessionType].cart = userCart
 
   const errors = []
   await context.req.session.save(err => { 
      if (err) { errors.push(err) }
   })
   if (errors.length > 0) { throw errors[0] } 
}


// checks if existing cart products on cart products property, and adds them if not
// otherwise updates quantity if exist mutates input
const _cartProductAdder = (cartProducts, product) => {
   const productIndex = cartProducts.length < 1 ? -1 : cartProducts
      .findIndex(_p => _p.product._id.toString() === product.product._id.toString()) 
      
   productIndex === -1 
      ? cartProducts.push(product) 
      : cartProducts[productIndex].quantity += product.quantity   
}


// merge guest cart and logged user cart
const _mergeCarts = context => {
   const { user, guest } = context.req.session
   
   if (!user.cart) {
      context.req.session.user.cart = { ...guest.cart }
      return;
   }
   
   const  userCart = [...user.cart.products]
   
   guest.cart.products.forEach(p => { _cartProductAdder(userCart, p) })   

   _cartSubtotal({ products: [...userCart], supTotal: 0 }, context)
   return;
}




const  Mutation = {   

   async createUser(parent, { userData }) {
      try {
         const { email, password } = userData
         const validatinResult = registerValidation(userData)

         const emailExist = await User.findOne({ email })
         if (emailExist) { throw new Error('email alredy exist') }

         const securePassword = await bcrypt.hash(password, 12)
         if (!securePassword) { throw new Error('An error has occured') }

         const user = new User({ 
            ...userData, 
            password: securePassword, 
            role: 'CUSTOMER',
            cart: null
          })
         await user.save()
         const { password: pass , ...restUser } = user.toObject()

         return { 
            ...restUser,
            createdAt: new Date(user.createdAt).toDateString(),
            updatedAt: new Date(user.updatedAt).toDateString()
         }

      } catch (err) { throw err }
   },


   async getSetGuest(parent, args, context) {
      try {
         //console.log('getSetGuest called...', context.req.session.guest)
         const { session, isAuth } = context.req
         if (isAuth) { return null }  

         const guest = session.guest ? { ...session.guest } : {
            _id: uniqid('GUEST'), 
            firstName: `GUEST-${context.req.ip}`, 
            lastName: 'none',   
            email: 'none',
            emailOffers: false,
            password: 'none',         
            role: 'GUEST',
            createdAt: new Date(),
            updatedAt: new Date()
         }

         context.req.session.guest = { ...guest }

         const errors = []
         await context.req.session.save(err => { 
            if (err) { errors.push(err) }
         })
         if (errors.length > 0) { throw errors[0] }
         //console.log('getSetGuest save...', context.req.session.guest)
         return !!guest

      } catch (err) { throw err }
   },
 

   async userLogin(parent, { email, password }, context) {
      try {
         const { session } = context.req
         const validationResults = loginValidation({ email, password })
         //console.log('check if session exists:\n', context.req.session, '\n**********')

         const user = await User.findOne({ email })
         if (!user) { throw new Error('Unable to find user') }

         const isPassword = await bcrypt.compare(password, user.password)
         if (!isPassword) { throw new Error('User not authenticated') }

         const token = jwt.sign(
            { userId: user._id.toString(), email, role: user.role },
            process.env.SECRET,
            { algorithm: 'HS256', expiresIn: '1h' }
            )
         if (!token) { throw new Error('token not generated') }
         //console.log(token)

         if (!(session.user && session.user._id.toString() === user._id.toString())) {
            context.req.session.user = user.toObject()
         }

         context.req.isAuth = true

         if (session.guest && session.guest.cart) { _mergeCarts(context) }
         context.req.session.guest = null 

         const errors = []
         await context.req.session.save(err => { 
            if (err) { errors.push(err) }
         })
         if (errors.length > 0) { throw errors[0] } 

         return { token, user: context.req.session.user }
      } catch (err) { throw err }
   },
 


   async createProduct(parent, { productData }, context) {
      try {
         const { isAuth, userAuthenticated } = context.req         
         const { name, images, description, price, inStock } = productData
         const validationResult = addProductValidation(productData)
         console.log('validatin result', validationResult)

         const userId = getAuthorizedUserId(context)
         
         if (!(isAuth && userAuthenticated.role === 'ADMINISTRATOR')) { 
            throw new Error('Unauthoraized user')
         }
         
         // write streams to fs
         const myImages = await processUploads(images)

         // upload images to claudinary         
         const myNewImages = await imagesToCloud(myImages)
            
         const imagesUrls = myNewImages
            .map(i => ({ url: i.secure_url, public_id: i.public_id }))
          
         // add to database
         const product = new Product({ name, imagesUrls, description, price, inStock })
         await product.save()

         // delete images from fs
         await deleteImages(myImages)

         return { 
            ...product.toObject(), 
            createdAt: new Date(product.createdAt).toDateString(),
            updatedAt: new Date(product.updatedAt).toDateString()
         }
      } catch (err) { throw err }
   },



   async updateProduct(parent, { productData, productId }, { req }) {
      try {
         const { isAuth, userAuthenticated } = req

         const { name, imagePaths, description, price, inStock } = productData

         if (!(isAuth && userAuthenticated.role === 'ADMINISTRATOR')) {
            throw new Error('Unauthoraized user')
         }
 
         const product = await Product.findById(productId)
         if (!product) { throw new Error('Product not found') }

         if (typeof name === 'string') { product.name = name }
         if (typeof description === 'string') { product.description = description }
         if (typeof price === 'number') { product.price = price }
         if (typeof inStock === 'boolean') { product.inStock = inStock }
         if (Array.isArray(imagePaths) && imagePaths.length > 0) {// need better implementation for updating
            product.imagePaths = imagePaths
         }
         await product.save()

         return { 
            ...product.toObject(), 
            createdAt: new Date(product.createdAt).toDateString(),
            updatedAt: new Date(product.updatedAt).toDateString()
         }
         
      } catch (err) { throw err }
   },



   async deleteProduct(parent, { productId }, { req }) {
      try {
         const { isAuth, userAuthenticated } = req

         if (!(isAuth && userAuthenticated.role === 'ADMINISTRATOR')) {
            throw new Error('Unauthoraized user')
         }

         const product = await Product.findById(productId)
         if (!product) { throw new Error('Product not found') }

         const deletedProduct = await Product.deleteOne({ _id: productId })
         if (!deletedProduct.ok) { throw new Error('Unable to delete product') }

         return { 
            ...product.toObject(), 
            createdAt: new Date(product.createdAt).toDateString(),
            updatedAt: new Date(product.updatedAt).toDateString()
         }
      } catch (err) { throw err }
   },



   async addToCart(parent, { productId, quantity }, context) {
      try {
         const { isAuth,  session } = context.req
         const sessionType = isAuth ? 'user' : 'guest'
 
         const _quantity = quantity || 1

         const product = await Product.findById(productId)
         if (!product) { throw new Error('Product not found') }

         const cart = session[sessionType].cart 
            ? { ...session[sessionType].cart } 
            : { products: [], subtotal: 0 }

         _cartProductAdder(cart.products, { product, quantity: _quantity })
         _cartSubtotal(cart, context)

         return { ...context.req.session[sessionType] } 

      } catch (err) { throw err }
   },



   async removeFromCart(parent, { productId }, context) {
      try {
         const { isAuth, session } = context.req

         const sessionType = isAuth ? 'user' : 'guest'
         
         const [productExist] = await Product.find({ _id: productId }, { "_id": 1 }).limit(1)     
         if (!productExist) { throw new Error('Product does not exists') }

         if (!session[sessionType].cart || session[sessionType].cart.products.length < 1) { 
            throw new Error('Product not in cart') 
         }

         const cart = { ...session[sessionType].cart }

         cart.products = cart.products
            .filter(p => p.product._id.toString() !== productId.toString()) 

         _cartSubtotal(cart, context)

         return { ...context.req.session[sessionType] } 
      } catch (err) { throw err }
   },



   async updateCartQuantity(parent, { productId, quantity }, context) {
      try {
         const { isAuth,  session } = context.req
         const sessionType = isAuth ? 'user' : 'guest'

         const cart = { ...session[sessionType].cart }

         if (quantity === 0) {
            cart.products = cart.products
               .filter(p => p.product._id.toString() !== productId.toString())
         } else {
            const productIndex = cart.products
               .findIndex(p => p.product._id.toString() === productId.toString())
            if (productIndex === -1) { throw new Error('Product not found') }             
            cart.products[productIndex].quantity = quantity
         }

         _cartSubtotal(cart, context)

         return { ...context.req.session[sessionType] } 

      } catch (err) { throw err }
   }


}



module.exports =   Mutation