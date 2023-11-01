```mermaid
sequenceDiagram
actor att AS Attendee
participant reg AS Registration Service
participant pay AS Payment Service

att ->> reg : register
activate reg
reg -->> att : "Thank you!"

alt is not presenter
reg ->> pay : make payment link
activate pay
pay -->> reg : <payment link>
deactivate pay
reg --) att : <payment link>
deactivate reg

att ->> pay : fulfill payment
activate pay
pay -->> att : "Thank you!"
pay --) reg : payment fulfilled
deactivate pay
end
```