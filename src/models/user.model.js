import mongoose,{Schema} from "mongoose";

import jwt from "jsonwebtoken";
import bcrypt from "bcrypt"
const userSchema= new Schema({
    usrname :{
        type:String,
        required:true,
        unique:true,
        lowercase:true,
        trim:true,
        index:true    // for better searching 
    },
    email:{
        type:String,
        required:true,
        unique:true,
        lowercase:true,
        trim:true,
    },
    fullName:{
        type:String,
        required:true,
        trim:true,
        index:true
    },
    avatar:{
        type:String,//cloudinary aws services
        required:true,
       
    },
    coverImage:{
        type:String,

    },
    watchHistory:[
        {
            type:Schema.Types.ObjectId,
            res:"Video"
        }
    ],
    password:{
        type:String,
        required:[true,'Password is required'],
        unique:true,
       
    },
    refreshToken:{
        type:String
    }
    

},{timeseries:true});//from timestamps we will get created at and updated at 
//for password encryption by using bycrypt
userSchema.pre("save",async function(next){
    if(!this.isModified("password"))return next();
    this.password=bcrypt.hash(this.password,10);
    next();
})
userSchema.methods.isPasswordCorrect=async function (password) {
    return await bcrypt.compare(password,this.password)
}

//jwt like a key security

userSchema.methods.generateAccessToken=function(){
    jwt.sign({
        _id:this.id,
        email:this.email,
        username:this.username,
        fullName:this.fullName,

    },
    process.env.ACCESS_TOKEN_SECRET,
    {
        expiresIn:process.env.ACCESS_TOKEN_EXPIRY
    }
)
}
userSchema.methods.generateRefreshToken=function(){
     jwt.sign({
        _id:this.id,
       

    },
    process.env.REFRESH_TOKEN_SECRET,
    {
        expiresIn:process.env.REFRESH_TOKEN_EXPIRY
    }
)
}


export const User=mongoose.model("User",userSchema);