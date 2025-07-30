using { ProcurementService } from '../../srv/cat-service.cds';

////////////////////////////////////////////////////////////////////////////
//
//	Suppliers Object Page
//
annotate ProcurementService.Suppliers with @(UI : {
    HeaderInfo: {
        TypeName      : '{i18n>Supplier}',
        TypeNamePlural: '{i18n>Suppliers}',
        Title         : {Value: name},
        Description   : {Value : region}
    },
    HeaderFacets: [{
        $Type : 'UI.ReferenceFacet',
        Label : '{i18n>Contact}',
        Target: '@UI.FieldGroup#Contact'
    }, ],
    Facets: [{
        $Type : 'UI.ReferenceFacet',
        Label : '{i18n>Details}',
        Target: '@UI.FieldGroup#Details'
    }, ],
    FieldGroup #Contact: {Data : [
        {Value : contactEmail},
        {Value : contactPhone},
        {Value : address}
    ]},
    FieldGroup #Details: {Data : [
        {Value: pricePerUnit},
        {Value: leadTime},
        {Value: rating},
        {Value: material},
    ]},
});

////////////////////////////////////////////////////////////////////////////
//
//	Suppliers List Page
//
annotate ProcurementService.Suppliers with @(UI : {
    SelectionFields: [
        ID,
        name,
        region,
        category
    ],
    LineItem: [
        {
            Value: ID,
            Label: '{i18n>ID}'
        },
        {
            Value: name,
            Label: '{i18n>Name}'
        },
        {Value: region},
        {Value: category},
        {Value: material},
        {Value: pricePerUnit},
        {Value: rating},
    ]
});
